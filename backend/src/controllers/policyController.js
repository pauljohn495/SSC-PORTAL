import PolicyDepartment from '../models/PolicyDepartment.js';
import PolicySection from '../models/PolicySection.js';
import User from '../models/User.js';
import { logActivity } from '../utils/activityLogger.js';
import { savePDFToFile, deletePDFFile, readPDFFromFile } from '../utils/fileStorage.js';
import { slugifyString } from '../utils/slugify.js';
import { setApiLogHeader } from '../utils/apiLogger.js';

const POLICY_UPLOAD_DIR = 'policies';

const logPolicyApi = (req, res, endpoint, status, message, content) => {
  setApiLogHeader(res, {
    method: req?.method || 'GET',
    endpoint,
    status,
    message,
    content,
  });
};

const buildAccessKey = (value = '') => slugifyString(value, 'department');

const ensureUserRole = async (userId, allowedRoles = []) => {
  if (!userId) {
    const error = new Error('User ID is required');
    error.statusCode = 400;
    throw error;
  }
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
  return user;
};

const ensureUniqueSlug = async (Model, base, filter = {}) => {
  const baseSlug = base || slugifyString('', 'item');
  let slug = baseSlug;
  let counter = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists({ ...filter, slug })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
};

const summarizeSection = (section) => ({
  _id: section._id,
  title: section.title,
  description: section.description,
  status: section.status,
  fileName: section.fileName,
  filePath: section.filePath,
  createdAt: section.createdAt,
  updatedAt: section.updatedAt,
  approvedAt: section.approvedAt,
  rejectionReason: section.rejectionReason,
});

export const getPresidentPolicyDepartments = async (req, res, next) => {
  try {
    const departments = await PolicyDepartment.find({ isArchived: { $ne: true } })
      .sort({ name: 1 })
      .lean();
    const departmentIds = departments.map((dept) => dept._id);
    const sections = await PolicySection.find({ department: { $in: departmentIds } })
      .sort({ createdAt: -1 })
      .lean();
    const sectionsByDept = sections.reduce((acc, section) => {
      acc[section.department.toString()] = acc[section.department.toString()] || [];
      acc[section.department.toString()].push(summarizeSection(section));
      return acc;
    }, {});
    const payload = departments.map((dept) => ({
      ...dept,
      sections: sectionsByDept[dept._id.toString()] || [],
    }));
    logPolicyApi(req, res, '/api/president/policies/departments', 200, 'Fetched policy departments', { count: payload.length });
    res.json(payload);
  } catch (error) {
    logPolicyApi(req, res, '/api/president/policies/departments', 500, 'Failed to fetch policy departments');
    next(error);
  }
};

export const createPolicyDepartment = async (req, res, next) => {
  try {
    const { userId, name, description, college } = req.body;
    const user = await ensureUserRole(userId, ['president']);

    if (!name) {
      logPolicyApi(req, res, '/api/president/policies/departments', 400, 'Department name is required');
      return res.status(400).json({ message: 'Department name is required' });
    }

    const accessKey = buildAccessKey(name);
    const slug = await ensureUniqueSlug(PolicyDepartment, accessKey);

    const existing = await PolicyDepartment.findOne({
      $or: [{ name: name.trim() }, { accessKey }],
    });
    if (existing) {
      logPolicyApi(req, res, '/api/president/policies/departments', 409, 'Department already exists');
      return res.status(409).json({ message: 'Department already exists' });
    }

    const department = await PolicyDepartment.create({
      name: name.trim(),
      description,
      college,
      accessKey,
      slug,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logActivity(user._id, 'policy_department_create', `Created policy department "${department.name}"`, {
      departmentId: department._id,
    }, req);

    logPolicyApi(req, res, '/api/president/policies/departments', 201, 'Created policy department', { departmentId: department._id });
    res.status(201).json(department);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, '/api/president/policies/departments', error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, '/api/president/policies/departments', 500, 'Failed to create policy department');
    next(error);
  }
};

export const updatePolicyDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, name, description, college, version } = req.body;
    const user = await ensureUserRole(userId, ['president']);

    const department = await PolicyDepartment.findById(id);
    if (!department || department.isArchived) {
      logPolicyApi(req, res, '/api/president/policies/departments/:id', 404, 'Department not found', { id });
      return res.status(404).json({ message: 'Department not found' });
    }

    // Optimistic concurrency: if client sends a numeric version and it
    // does not match the current one, reject with a conflict.
    if (Number.isFinite(Number(version))) {
      const numericVersion = Number(version);
      if (department.version !== numericVersion) {
        logPolicyApi(req, res, '/api/president/policies/departments/:id', 409, 'Department version conflict', { id });
        return res.status(409).json({ message: 'Department has been modified. Please refresh and try again.' });
      }
    }

    if (name && name.trim() && name.trim() !== department.name) {
      const accessKey = buildAccessKey(name);
      const existing = await PolicyDepartment.findOne({
        $or: [{ name: name.trim() }, { accessKey }],
        _id: { $ne: id },
      });
      if (existing) {
        logPolicyApi(req, res, '/api/president/policies/departments/:id', 409, 'Department name already used', { id });
        return res.status(409).json({ message: 'Another department already uses that name' });
      }
      department.name = name.trim();
      department.accessKey = accessKey;
      department.slug = await ensureUniqueSlug(PolicyDepartment, accessKey, { _id: { $ne: id } });
    }

    if (typeof description === 'string') {
      department.description = description;
    }
    if (typeof college === 'string') {
      department.college = college;
    }
    department.updatedBy = user._id;
    department.version = (department.version || 1) + 1;
    await department.save();

    await logActivity(user._id, 'policy_department_update', `Updated policy department "${department.name}"`, {
      departmentId: department._id,
    }, req);

    logPolicyApi(req, res, '/api/president/policies/departments/:id', 200, 'Updated policy department', { id });
    res.json(department);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, '/api/president/policies/departments/:id', error.statusCode, error.message, { id: req.params.id });
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, '/api/president/policies/departments/:id', 500, 'Failed to update policy department', { id: req.params.id });
    next(error);
  }
};

export const deletePolicySection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await ensureUserRole(userId, ['president']);

    const section = await PolicySection.findById(id);
    if (!section) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${id}`, 404, 'Section not found');
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.filePath) {
      deletePDFFile(section.filePath);
    }
    await section.deleteOne();

    await logActivity(user._id, 'policy_section_delete', `Deleted policy section "${section.title}"`, {
      sectionId: section._id,
    }, req);

    res.json({ message: 'Section deleted' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

export const deletePolicySectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const admin = await ensureUserRole(adminId, ['admin']);

    const section = await PolicySection.findById(id);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    section.archived = true;
    section.archivedAt = new Date();
    await section.save();

    await logActivity(admin._id, 'policy_section_archive', `Admin archived policy section "${section.title}"`, {
      sectionId: section._id,
    }, req);

    logPolicyApi(req, res, `/api/admin/policies/sections/${id}`, 200, 'Archived policy section');
    res.json({ message: 'Section archived' });
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}`, error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}`, 500, 'Failed to archive policy section');
    next(error);
  }
};

export const restorePolicySectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const admin = await ensureUserRole(adminId, ['admin']);

    const section = await PolicySection.findById(id);
    if (!section) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${id}/restore`, 404, 'Section not found');
      return res.status(404).json({ message: 'Section not found' });
    }

    if (!section.archived) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${id}/restore`, 400, 'Section is not archived');
      return res.status(400).json({ message: 'Section is not archived' });
    }

    section.archived = false;
    section.archivedAt = null;
    await section.save();

    await logActivity(admin._id, 'policy_section_restore', `Admin restored policy section "${section.title}"`, {
      sectionId: section._id,
    }, req);

    logPolicyApi(req, res, `/api/admin/policies/sections/${id}/restore`, 200, 'Restored policy section');
    res.json({ message: 'Section restored', section });
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}/restore`, error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}/restore`, 500, 'Failed to restore policy section');
    next(error);
  }
};

export const permanentlyDeletePolicySectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const admin = await ensureUserRole(adminId, ['admin']);

    const section = await PolicySection.findById(id);
    if (!section) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${id}/permanent`, 404, 'Section not found');
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.filePath) {
      deletePDFFile(section.filePath);
    }
    await section.deleteOne();

    await logActivity(admin._id, 'policy_section_delete_permanent', `Admin permanently deleted policy section "${section.title}"`, {
      sectionId: section._id,
    }, req);

    logPolicyApi(req, res, `/api/admin/policies/sections/${id}/permanent`, 200, 'Permanently deleted policy section');
    res.json({ message: 'Section deleted permanently' });
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}/permanent`, error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.id}/permanent`, 500, 'Failed to delete policy section permanently');
    next(error);
  }
};

export const createPolicySection = async (req, res, next) => {
  try {
    const { userId, departmentId, title, description, fileUrl, fileName } = req.body;
    const user = await ensureUserRole(userId, ['president']);

    if (!departmentId) {
      logPolicyApi(req, res, '/api/president/policies/sections', 400, 'Department is required');
      return res.status(400).json({ message: 'Department is required' });
    }
    if (!title) {
      logPolicyApi(req, res, '/api/president/policies/sections', 400, 'Section title is required');
      return res.status(400).json({ message: 'Section title is required' });
    }
    if (!fileUrl) {
      logPolicyApi(req, res, '/api/president/policies/sections', 400, 'PDF file is required');
      return res.status(400).json({ message: 'PDF file is required' });
    }

    const department = await PolicyDepartment.findById(departmentId);
    if (!department || department.isArchived) {
      logPolicyApi(req, res, '/api/president/policies/sections', 404, 'Department not found', { departmentId });
      return res.status(404).json({ message: 'Department not found' });
    }

    const sectionSlug = await ensureUniqueSlug(PolicySection, slugifyString(title, 'section'), { department: departmentId });
    const storagePath = savePDFToFile(fileUrl, fileName || `${sectionSlug}.pdf`, POLICY_UPLOAD_DIR);

    const section = await PolicySection.create({
      department: departmentId,
      title: title.trim(),
      slug: sectionSlug,
      description,
      filePath: storagePath,
      fileName: fileName || `${sectionSlug}.pdf`,
      createdBy: user._id,
      status: 'pending',
    });

    await logActivity(user._id, 'policy_section_create', `Uploaded policy section "${section.title}"`, {
      sectionId: section._id,
      departmentId,
    }, req);

    logPolicyApi(req, res, '/api/president/policies/sections', 201, 'Created policy section', { sectionId: section._id });
    res.status(201).json(section);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, '/api/president/policies/sections', error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, '/api/president/policies/sections', 500, 'Failed to create policy section');
    next(error);
  }
};

export const updatePolicySection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, title, description, fileUrl, fileName, departmentId } = req.body;
    const user = await ensureUserRole(userId, ['president']);

    const section = await PolicySection.findById(id);
    if (!section) {
      logPolicyApi(req, res, '/api/president/policies/sections/:id', 404, 'Section not found', { id });
      return res.status(404).json({ message: 'Section not found' });
    }

    if (departmentId && departmentId !== section.department.toString()) {
      const department = await PolicyDepartment.findById(departmentId);
      if (!department) {
        logPolicyApi(req, res, '/api/president/policies/sections/:id', 404, 'Target department not found', { departmentId });
        return res.status(404).json({ message: 'Target department not found' });
      }
      section.department = departmentId;
    }

    if (title && title.trim()) {
      section.title = title.trim();
      section.slug = await ensureUniqueSlug(
        PolicySection,
        slugifyString(section.title, 'section'),
        { department: section.department, _id: { $ne: id } },
      );
    }
    if (typeof description === 'string') {
      section.description = description;
    }

    if (fileUrl) {
      if (section.filePath) {
        deletePDFFile(section.filePath);
      }
      const newPath = savePDFToFile(fileUrl, fileName || section.fileName || `${section.slug}.pdf`, POLICY_UPLOAD_DIR);
      section.filePath = newPath;
      if (fileName) {
        section.fileName = fileName;
      }
    } else if (fileName) {
      section.fileName = fileName;
    }

    section.status = 'pending';
    section.approvedBy = null;
    section.approvedAt = null;
    section.rejectionReason = null;
    section.updatedBy = user._id;
    await section.save();

    await logActivity(user._id, 'policy_section_update', `Updated policy section "${section.title}"`, {
      sectionId: section._id,
    }, req);

    logPolicyApi(req, res, '/api/president/policies/sections/:id', 200, 'Updated policy section', { id });
    res.json(section);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, '/api/president/policies/sections/:id', error.statusCode, error.message, { id: req.params.id });
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, '/api/president/policies/sections/:id', 500, 'Failed to update policy section', { id: req.params.id });
    next(error);
  }
};

export const getPolicySectionsForReview = async (req, res, next) => {
  try {
    const { status } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected'];
    
    // Build query - if status is provided, validate and filter by it, otherwise get all
    const query = { archived: { $ne: true } };
    if (status) {
      if (!validStatuses.includes(status)) {
        logPolicyApi(req, res, '/api/admin/policies/sections', 400, 'Invalid status filter', { status });
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = status;
    }
    
    const sections = await PolicySection.find(query)
      .populate('department', 'name accessKey')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    logPolicyApi(req, res, '/api/admin/policies/sections', 200, 'Fetched policy sections for review', { status: status || 'all', count: sections.length });
    res.json(sections);
  } catch (error) {
    logPolicyApi(req, res, '/api/admin/policies/sections', 500, 'Failed to fetch policy sections for review');
    next(error);
  }
};

export const getArchivedPolicySections = async (req, res, next) => {
  try {
    const sections = await PolicySection.find({ archived: true })
      .populate('department', 'name accessKey')
      .populate('createdBy', 'name email')
      .sort({ archivedAt: -1 });
    logPolicyApi(req, res, '/api/admin/policies/sections/archived', 200, 'Fetched archived policy sections', { count: sections.length });
    res.json(sections);
  } catch (error) {
    logPolicyApi(req, res, '/api/admin/policies/sections/archived', 500, 'Failed to fetch archived policy sections');
    next(error);
  }
};

export const reviewPolicySection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { adminId, status, rejectionReason } = req.body;
    const admin = await ensureUserRole(adminId, ['admin']);

    if (!['approved', 'rejected'].includes(status)) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${sectionId}/status`, 400, 'Invalid status', { status });
      return res.status(400).json({ message: 'Invalid status' });
    }

    const section = await PolicySection.findById(sectionId);
    if (!section) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${sectionId}/status`, 404, 'Section not found');
      return res.status(404).json({ message: 'Section not found' });
    }

    section.status = status;
    section.approvedBy = admin._id;
    section.approvedAt = new Date();
    section.rejectionReason = status === 'rejected' ? (rejectionReason || 'Rejected by admin') : null;
    await section.save();

    await logActivity(admin._id, 'policy_section_review', `Marked policy section "${section.title}" as ${status}`, {
      sectionId: section._id,
      status,
    }, req);

    logPolicyApi(req, res, `/api/admin/policies/sections/${sectionId}/status`, 200, 'Reviewed policy section', { status });
    res.json(section);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.sectionId}/status`, error.statusCode, error.message);
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, `/api/admin/policies/sections/${req.params.sectionId}/status`, 500, 'Failed to review policy section');
    next(error);
  }
};

export const getStudentPolicies = async (req, res, next) => {
  try {
    const { userId } = req.query;
    const user = await ensureUserRole(userId, ['student', 'admin', 'president']);
    const accessKey = buildAccessKey(user.department || '');

    const department = await PolicyDepartment.findOne({ accessKey, isArchived: { $ne: true } }).lean();
    if (!department) {
      logPolicyApi(req, res, '/api/policies', 200, 'No policies for department', { userId });
      return res.json([]);
    }
    const sections = await PolicySection.find({
      department: department._id,
      status: 'approved',
    })
      .sort({ title: 1 })
      .lean();

    const responseBody = [{
      ...department,
      sections: sections.map(summarizeSection),
    }];

    logPolicyApi(req, res, '/api/policies', 200, 'Fetched student policies', {
      userId,
      department: department.name,
      sections: sections.length,
    });

    return res.json(responseBody);
  } catch (error) {
    if (error.statusCode) {
      logPolicyApi(req, res, '/api/policies', error.statusCode, error.message, { userId: req.query.userId });
      return res.status(error.statusCode).json({ message: error.message });
    }
    logPolicyApi(req, res, '/api/policies', 500, 'Failed to fetch student policies');
    next(error);
  }
};

export const streamPolicySectionFile = async (req, res, next) => {
  try {
    const endpoint = '/api/policies/sections/:sectionId/file';
    const { sectionId } = req.params;
    const { userId } = req.query;
    if (!sectionId) {
      logPolicyApi(req, res, endpoint, 400, 'Section ID is required');
      return res.status(400).json({ message: 'Section ID is required' });
    }

    let role = 'guest';
    let departmentKey = null;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        role = user.role;
        departmentKey = buildAccessKey(user.department || '');
      }
    }

    const section = await PolicySection.findById(sectionId).populate('department');
    if (!section) {
      logPolicyApi(req, res, endpoint, 404, 'Section not found', { sectionId });
      return res.status(404).json({ message: 'Section not found' });
    }

    const isStaff = ['admin', 'president'].includes(role);
    if (section.status !== 'approved' && !isStaff) {
      logPolicyApi(req, res, endpoint, 403, 'Section not available', { sectionId, role });
      return res.status(403).json({ message: 'Section not available' });
    }

    if (!isStaff && role === 'student') {
      if (!section.department || section.department.accessKey !== departmentKey) {
        logPolicyApi(req, res, endpoint, 403, 'Student lacks access to section', { sectionId, role });
        return res.status(403).json({ message: 'You do not have access to this section' });
      }
    }

    if (!section.filePath) {
      logPolicyApi(req, res, endpoint, 404, 'Section file not found', { sectionId });
      return res.status(404).json({ message: 'File not found' });
    }

    const pdfBuffer = readPDFFromFile(section.filePath);
    const fileName = section.fileName || `${section.slug}.pdf`;

    logPolicyApi(req, res, endpoint, 200, 'Streaming policy section file', { sectionId, role });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    logPolicyApi(req, res, '/api/policies/sections/:sectionId/file', 500, 'Failed to stream policy section file');
    next(error);
  }
};

