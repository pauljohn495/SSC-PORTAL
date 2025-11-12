import { searchAlgolia } from '../services/algoliaService.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text = '', query = '') => {
  if (!text || !query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

const buildHandbookResult = (handbook, query) => ({
  id: handbook._id.toString(),
  type: 'handbook',
  title: `Handbook Page ${handbook.pageNumber}`,
  titleSnippet: highlightText(`Handbook Page ${handbook.pageNumber}`, query),
  snippet: highlightText(handbook.content?.slice(0, 200) || '', query),
  pageNumber: handbook.pageNumber,
  year: null,
  status: handbook.status,
  createdAt: handbook.createdAt,
  uploadedAt: handbook.updatedAt || handbook.createdAt
});

const buildMemorandumResult = (memorandum, query) => ({
  id: memorandum._id.toString(),
  type: 'memorandum',
  title: memorandum.title,
  titleSnippet: highlightText(memorandum.title, query),
  snippet: '',
  pageNumber: null,
  year: memorandum.year,
  status: memorandum.status,
  createdAt: memorandum.uploadedAt || memorandum.createdAt,
  uploadedAt: memorandum.uploadedAt || memorandum.createdAt,
  fileUrl: memorandum.fileUrl
});

const dbFallbackSearch = async ({ query, role, type, year, limit = 50 }) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const regexQuery = new RegExp(escapeRegex(trimmedQuery), 'i');
  const normalizedType = type && type !== 'all' ? type : 'all';

  const visibilityRoles = {
    student: ['student'],
    admin: ['student', 'admin'],
    president: ['student', 'admin', 'president']
  };

  const allowedVisibilities = visibilityRoles[role] || visibilityRoles.student;

  const queryTasks = [];

  if (normalizedType === 'all' || normalizedType === 'handbook') {
    queryTasks.push({
      key: 'handbook',
      promise: Handbook.find({
        status: 'approved',
        content: regexQuery
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean()
    });
  }

  if (normalizedType === 'all' || normalizedType === 'memorandum') {
    const memoFilter = {
      status: 'approved',
      $or: [
        { title: regexQuery },
        { fileName: regexQuery },
        { pdfContent: regexQuery }
      ]
    };
    if (year) {
      memoFilter.year = Number(year);
    }

    queryTasks.push({
      key: 'memorandum',
      promise: Memorandum.find(memoFilter)
        .sort({ uploadedAt: -1 })
        .limit(limit)
        .lean()
    });
  }

  const settledResults = await Promise.all(
    queryTasks.map((task) => task.promise.catch(() => []))
  );

  let handbooks = [];
  let memorandums = [];

  settledResults.forEach((docs, index) => {
    const { key } = queryTasks[index];
    if (key === 'handbook') {
      handbooks = docs;
    } else if (key === 'memorandum') {
      memorandums = docs;
    }
  });

  const filteredHandbooks = handbooks
    .filter(() => allowedVisibilities.includes('student'))
    .map((handbook) => buildHandbookResult(handbook, trimmedQuery));

  const filteredMemos = memorandums
    .filter(() => allowedVisibilities.includes('student'))
    .map((memo) => buildMemorandumResult(memo, trimmedQuery));

  return [...filteredHandbooks, ...filteredMemos]
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, limit);
};

export const searchContent = async (req, res) => {
  try {
    const {
      q = '',
      role = 'student',
      type,
      year,
      page = 1,
      perPage = 10
    } = req.query;

    if (!q.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchResponse = await searchAlgolia({
      query: q.trim(),
      role,
      type,
      year,
      page: Math.max(Number(page) - 1, 0),
      hitsPerPage: Math.min(Number(perPage) || 10, 50)
    });

    let results = (searchResponse.hits || []).map((hit) => ({
      id: hit.objectID,
      type: hit.type,
      title: hit.title,
      titleSnippet: hit._highlightResult?.title?.value || hit.title,
      snippet: hit._highlightResult?.content?.value || '',
      pageNumber: hit.pageNumber,
      year: hit.year,
      status: hit.status,
      createdAt: hit.createdAt,
      uploadedAt: hit.uploadedAt,
      fileUrl: hit.fileUrl
    }));

    const totalHits = searchResponse?.nbHits ?? 0;

    if (totalHits === 0) {
      const fallbackResults = await dbFallbackSearch({
        query: q,
        role,
        type,
        year,
        limit: Math.min(Number(perPage) || 10, 50)
      });

      if (fallbackResults.length > 0) {
        results = fallbackResults;
        return res.json({
          query: q.trim(),
          found: fallbackResults.length,
          page: 1,
          perPage: fallbackResults.length,
          totalPages: 1,
          results,
          source: 'database'
        });
      }
    }

    res.json({
      query: q.trim(),
      found: searchResponse.nbHits,
      page: (searchResponse.page || 0) + 1,
      perPage: searchResponse.hitsPerPage,
      totalPages: searchResponse.nbPages,
      results,
      source: 'algolia'
    });
  } catch (error) {
    console.error('Algolia search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};


