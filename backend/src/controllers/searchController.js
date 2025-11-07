import { searchAlgolia } from '../services/algoliaService.js';

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

    const results = (searchResponse.hits || []).map((hit) => ({
      id: hit.objectID,
      type: hit.type,
      title: hit.title,
      titleSnippet: hit._highlightResult?.title?.value || hit.title,
      snippet: hit._highlightResult?.content?.value || '',
      pageNumber: hit.pageNumber,
      year: hit.year,
      status: hit.status,
      createdAt: hit.createdAt,
      uploadedAt: hit.uploadedAt
    }));

    res.json({
      query: q.trim(),
      found: searchResponse.nbHits,
      page: (searchResponse.page || 0) + 1,
      perPage: searchResponse.hitsPerPage,
      totalPages: searchResponse.nbPages,
      results
    });
  } catch (error) {
    console.error('Algolia search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};


