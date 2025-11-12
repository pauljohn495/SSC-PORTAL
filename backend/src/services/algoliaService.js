import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const algoliaPackage = require('algoliasearch');
const algoliasearch =
  typeof algoliaPackage === 'function'
    ? algoliaPackage
    : typeof algoliaPackage?.default === 'function'
      ? algoliaPackage.default
      : algoliaPackage.algoliasearch;

if (typeof algoliasearch !== 'function') {
  throw new Error('Failed to load Algolia client factory.');
}
import { config } from '../config/index.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';

let client = null;
let index = null;

const isAlgoliaConfigured = () => {
  return Boolean(
    config.algolia?.appId &&
    config.algolia?.adminApiKey &&
    config.algolia?.indexName
  );
};

const getClient = () => {
  if (!isAlgoliaConfigured()) {
    return null;
  }

  if (!client) {
    client = algoliasearch(config.algolia.appId, config.algolia.adminApiKey);
  }

  return client;
};

const buildIndexWrapper = (algoliaClient) => {
  const indexName = config.algolia.indexName;

  return {
    saveObject: (payload) => algoliaClient.saveObject({
      indexName,
      body: payload
    }),
    deleteObject: (objectID) => algoliaClient.deleteObject({
      indexName,
      objectID
    }),
    search: (query, searchParams) => algoliaClient.searchSingleIndex({
      indexName,
      searchParams: {
        ...searchParams,
        query
      }
    })
  };
};

const getIndex = () => {
  const algoliaClient = getClient();
  if (!algoliaClient) {
    return null;
  }

  if (!index) {
    if (typeof algoliaClient.initIndex === 'function') {
      index = algoliaClient.initIndex(config.algolia.indexName);
    } else if (
      typeof algoliaClient.saveObject === 'function' &&
      typeof algoliaClient.searchSingleIndex === 'function'
    ) {
      index = buildIndexWrapper(algoliaClient);
    } else {
      return null;
    }
  }

  return index;
};

const baseDocument = (data) => ({
  objectID: data.id,
  type: data.type,
  title: data.title,
  content: data.content || '',
  status: data.status || 'draft',
  visibility: data.visibility || 'student',
  pageNumber: data.pageNumber ?? null,
  year: data.year ?? null,
  createdAt: data.createdAt,
  uploadedAt: data.uploadedAt ?? data.createdAt,
  version: data.version ?? 1
});

const buildHandbookDocument = (handbook) => ({
  ...baseDocument({
    id: handbook._id.toString(),
    type: 'handbook',
    title: `Handbook Page ${handbook.pageNumber}`,
    content: handbook.content || '',
    status: handbook.status,
    visibility: 'student',
    pageNumber: handbook.pageNumber,
    createdAt: handbook.createdAt?.toISOString?.() || new Date().toISOString(),
    uploadedAt: handbook.updatedAt?.toISOString?.() || handbook.createdAt?.toISOString?.(),
    version: handbook.version
  })
});

const buildMemorandumDocument = (memorandum) => {
  // Combine title, fileName, and PDF content for searchable content
  const searchableContent = [
    memorandum.title || '',
    memorandum.fileName || '',
    memorandum.pdfContent || ''
  ].filter(Boolean).join(' ').trim();
  
  return {
    ...baseDocument({
      id: memorandum._id.toString(),
      type: 'memorandum',
      title: memorandum.title || 'Memorandum',
      content: searchableContent || memorandum.title || '',
      status: memorandum.status,
      visibility: 'student',
      year: memorandum.year,
      createdAt: memorandum.uploadedAt?.toISOString?.() || new Date().toISOString(),
      uploadedAt: memorandum.uploadedAt?.toISOString?.(),
      version: memorandum.version
    }),
    fileUrl: memorandum.fileUrl || '',
    fileName: memorandum.fileName || '',
    pdfContent: memorandum.pdfContent || ''
  };
};

export const saveHandbookToAlgolia = async (handbook) => {
  if (!isAlgoliaConfigured() || !handbook) return;

  if (handbook.status !== 'approved') {
    await removeFromAlgolia(handbook._id);
    return;
  }

  const algoliaIndex = getIndex();
  if (!algoliaIndex) return;

  const document = buildHandbookDocument(handbook);

  await algoliaIndex.saveObject(document).catch((error) => {
    console.error('Algolia save (handbook) failed:', error);
  });
};

export const saveMemorandumToAlgolia = async (memorandum) => {
  if (!isAlgoliaConfigured() || !memorandum) return;

  if (memorandum.status !== 'approved') {
    await removeFromAlgolia(memorandum._id);
    return;
  }

  const algoliaIndex = getIndex();
  if (!algoliaIndex) return;

  const document = buildMemorandumDocument(memorandum);

  await algoliaIndex.saveObject(document).catch((error) => {
    console.error('Algolia save (memorandum) failed:', error);
  });
};

export const removeFromAlgolia = async (id) => {
  if (!isAlgoliaConfigured() || !id) return;

  const algoliaIndex = getIndex();
  if (!algoliaIndex) return;

  await algoliaIndex.deleteObject(id.toString()).catch((error) => {
    if (error?.status === 404) return;
    console.error('Algolia delete failed:', error);
  });
};

const visibilityFilters = {
  student: ['student'],
  admin: ['student', 'admin'],
  president: ['student', 'admin', 'president']
};

export const searchAlgolia = async ({ query, role = 'student', type, year, page = 0, hitsPerPage = 10 }) => {
  if (!isAlgoliaConfigured()) {
    throw new Error('Search service not configured');
  }

  const algoliaIndex = getIndex();
  if (!algoliaIndex) {
    throw new Error('Search client not available');
  }

  const filters = [];

  const visibilities = visibilityFilters[role] || visibilityFilters.student;
  if (visibilities.length === 1) {
    filters.push(`visibility:"${visibilities[0]}"`);
  } else {
    const visibilityFilter = visibilities.map((val) => `visibility:"${val}"`).join(' OR ');
    filters.push(`(${visibilityFilter})`);
  }

  if (type && type !== 'all') {
    filters.push(`type:"${type}"`);
  }

  if (year) {
    const numericYear = Number(year);
    if (!Number.isNaN(numericYear)) {
      filters.push(`year:${numericYear}`);
    }
  }

  if (filters.length === 0) {
    filters.push('status:"approved"');
  } else {
    filters.push('status:"approved"');
  }

  const searchParams = {
    query,
    page,
    hitsPerPage,
    filters: filters.join(' AND '),
    attributesToHighlight: ['title', 'content', 'fileName', 'pdfContent'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>'
  };

  const response = await algoliaIndex.search(query || '', searchParams);

  const totalHits = response?.nbHits ?? 0;
  if (totalHits === 0 && filters.length > 1) {
    const fallbackFilters = 'status:"approved"';
    const fallbackResponse = await algoliaIndex.search(query || '', {
      ...searchParams,
      filters: fallbackFilters
    });

    if ((fallbackResponse?.nbHits ?? 0) > 0) {
      return {
        ...fallbackResponse,
        __usedFallbackFilters: true,
        __originalFilters: searchParams.filters
      };
    }
  }

  return response;
};

const saveDocumentsInBatches = async (algoliaIndex, documents) => {
  if (!documents.length) return;

  if (typeof algoliaIndex.replaceAllObjects === 'function') {
    await algoliaIndex.replaceAllObjects(documents);
    return;
  }

  if (typeof algoliaIndex.saveObjects === 'function') {
    await algoliaIndex.saveObjects(documents);
    return;
  }

  for (const doc of documents) {
    // eslint-disable-next-line no-await-in-loop
    await algoliaIndex.saveObject(doc);
  }
};

export const rebuildAlgoliaIndex = async () => {
  if (!isAlgoliaConfigured()) {
    console.info('[Algolia] Skipping rebuild; service not configured.');
    return;
  }

  const algoliaIndex = getIndex();
  if (!algoliaIndex) {
    console.warn('[Algolia] Unable to rebuild index: client unavailable.');
    return;
  }

  const [handbooks, memorandums] = await Promise.all([
    Handbook.find({ status: 'approved' }).lean().exec(),
    Memorandum.find({ status: 'approved' }).lean().exec()
  ]);

  const documents = [
    ...handbooks.map((handbook) => buildHandbookDocument(handbook)),
    ...memorandums.map((memorandum) => buildMemorandumDocument(memorandum))
  ];

  await saveDocumentsInBatches(algoliaIndex, documents);

  console.info('[Algolia] Rebuilt index with', documents.length, 'documents.');
};


