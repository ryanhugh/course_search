/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import URI from 'urijs';

import macros from './macros';
import request from './request';

class Search {
  constructor() {
    // Mapping of search term to an array of the results that have been loaded so far.
      
    this.cache = {};

    // Queries that have loaded all of the results, and no longer need to hit the server for any more.
    this.allLoaded = {};
  }


  // Min terms is the minimum number of terms needed.
  // When this function is called for the first time for a given query, it will be 4.
  // Then, on subsequent calls, it will be 14, 24, etc. (if increasing by 10)
  async search(query, termId, termCount) {
    // Searches are case insensitive.
    query = query.trim().toLowerCase();

    if (!query || query.length === 0) {
      macros.log('No query given in frontend/search.js. Returning empty array.', query, termCount);
      return { results: [] };
    }

    if (!termId || termId.length !== 6) {
      macros.log('No termId given in frontend/search.js. Returning empty array.', termId, termCount);
      return { results: [] };
    }

    let existingTermCount = 0;
    if (this.cache[termId + query]) {
      existingTermCount = this.cache[termId + query].results.length;
    }

    // Cache hit
    if (termCount <= existingTermCount && existingTermCount > 0 || this.allLoaded[termId + query]) {
      macros.log('Cache hit.', this.allLoaded[termId + query]);
      return {
	results: this.cache[termId + query].results.slice(0, termCount),
	subjectName: this.cache[termId + query].subjectName,
	subjectCount: this.cache[termId + query].subjectCount,
      };
    }

    // If we got here, we need to hit the network.
    macros.log('Requesting terms ', existingTermCount, 'to', termCount);


    const url = new URI('/search').query({
      query: query,
      termId: termId,
      minIndex: existingTermCount,
      maxIndex: termCount,
    }).toString();

    const startTime = Date.now();
    const waitedRequest = await request.get(url);

    const results = waitedRequest.results;
    window.amplitude.logEvent('Search Timing', {
      query: query.toLowerCase(),
      time: Date.now() - startTime,
      startIndex: existingTermCount,
      endIndex: termCount,
    });

    if (results.error) {
      macros.error('Error with networking request', results.error);
      return { results: [] };
    }


    if (!this.cache[termId + query]) {
      this.cache[termId + query] = {};
      this.cache[termId + query].results = [];
      this.cache[termId + query].subjectName = waitedRequest.subjectName;
      this.cache[termId + query].subjectCount = waitedRequest.subjectCount;
    }

    // Add to the end of exiting results.
    this.cache[termId + query].results = this.cache[termId + query].results.concat(results);


    if (results.length < termCount - existingTermCount) {
      this.allLoaded[termId + query] = true;
    }
    return ({
      subjectName: this.cache[termId + query].subjectName,
      subjectCount: this.cache[termId + query].subjectCount,
      results: this.cache[termId + query].results,
    });
  }
}

export default new Search();
