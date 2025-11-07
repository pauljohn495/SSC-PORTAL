import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const algoliaPackage = require('algoliasearch');
const clientSearch = require('@algolia/client-search');
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

let client = null;

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
    console.log('[Algolia] client type:', typeof client, 'keys:', Object.keys(client || {}));
    if (!client || typeof client.initIndex !== 'function') {
      console.error('Algolia client missing initIndex. Inspect client:', client);
    }
  }

  return client;
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

export const saveHandbookToAlgolia = async (handbook) => {
  if (!isAlgoliaConfigured() || !handbook) return;

  if (handbook.status !== 'approved') {
    await removeFromAlgolia(handbook._id);
    return;
  }

  const algoliaClient = getClient();
  if (!algoliaClient) return;

  const document = baseDocument({
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
  });

  await algoliaClient.saveObject({
    indexName: config.algolia.indexName,
    body: document
  }).catch((error) => {
    console.error('Algolia save (handbook) failed:', error);
  });
};

export const saveMemorandumToAlgolia = async (memorandum) => {
  if (!isAlgoliaConfigured() || !memorandum) return;

  if (memorandum.status !== 'approved') {
    await removeFromAlgolia(memorandum._id);
    return;
  }

  const algoliaClient = getClient();
  if (!algoliaClient) return;

  const document = baseDocument({
    id: memorandum._id.toString(),
    type: 'memorandum',
    title: memorandum.title || 'Memorandum',
    content: memorandum.title || '',
    status: memorandum.status,
    visibility: 'student',
    year: memorandum.year,
    createdAt: memorandum.uploadedAt?.toISOString?.() || new Date().toISOString(),
    uploadedAt: memorandum.uploadedAt?.toISOString?.(),
    version: memorandum.version
  });

  await algoliaClient.saveObject({
    indexName: config.algolia.indexName,
    body: document
  }).catch((error) => {
    console.error('Algolia save (memorandum) failed:', error);
  });
};

export const removeFromAlgolia = async (id) => {
  if (!isAlgoliaConfigured() || !id) return;

  const algoliaClient = getClient();
  if (!algoliaClient) return;

  await algoliaClient.deleteObject({
    indexName: config.algolia.indexName,
    objectID: id.toString()
  }).catch((error) => {
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

  const algoliaClient = getClient();
  if (!algoliaClient) {
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
    attributesToHighlight: ['title', 'content'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>'
  };

  const response = await algoliaClient.searchSingleIndex({
    indexName: config.algolia.indexName,
    searchParams: {
      ...searchParams,
      query: query || ''
    }
  });
  return response;
};


