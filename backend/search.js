/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */


import Keys from '../common/Keys';
import macros from './macros';

// The plan is to use this in both the frontend and the backend.
// Right now it is only in use in the backend.

// Should eventually get some tests running to make sure these stay working
// cs2500 (this one and not the lab)
// cs2501
// ood
// ml (ml should be high up there)
// ai
// razzaq
// cooperman
// cs
// math
// algo (CS 5800)
// algo and data (CS 4800)
// orgo (this one and fundies are hardcoded)
// fundies


const classSearchConfig = {
  fields: {
    classId: {
      boost: 4,
    },
    acronym: {
      boost: 4,
    },
    subject: {
      boost: 2,
    },
    desc: {
      boost: 1,
    },

    // Don't make the name value too high or searching for "cs2500" will come up with the lab (which mentions cs 2500 in it's name) instead of CS 2500.
    name: {
      boost: 1.1,
    },
    profs: {
      boost: 1,
    },

    // Enable this again if this is added to the index.

    // locations: {
    //   boost: 1,
    // },
    crns: {
      boost: 1,
    },
  },
  expand: true,
};

const employeeSearchConfig = {
  fields: {
    name: {
      boost: 2,
    },

    // It is very unlikely that someone will search for these,
    //so we want to keep the scoring low so they don't come up when the user searches for one of the other fields.
    primaryRole: {
      boost: 0.4,
    },
    primaryDepartment: {
      boost: 0.4,
    },
    emails: {
      boost: 1,
    },
    phone: {
      boost: 1,
    },
    // officeRoom: {
    //   boost: 1,
    // },
  },
  expand: true,
};


class Search {
  constructor(employeeMap, employeeSearchIndex, dataLib, searchIndexies) {
    // map of termId to search index and dump
    this.dataLib = dataLib;
    this.searchIndexies = searchIndexies;

    this.employeeMap = employeeMap;
    this.employeeSearchIndex = employeeSearchIndex;

    // Save the refs for each query. This is a map from the query to a object like this: {refs: [...], time: Date.now()}
    // These are purged every so often.
    this.refCache = {};
    this.itemsInCache = 0;


    this.onInterval = this.onInterval.bind(this);

    // 24 HR in ms
    setInterval(this.onInterval, 86400000);
  }

  // Use this to create a search intance
  // All of these arguments should already be JSON.parsed(). (Eg, they should be objects, not strings).
  static create(employeeMap, employeeSearchIndex, termDumps, searchIndexies) {
    // Some sanitiy checking
    if (!employeeMap || !employeeSearchIndex || !termDumps || !searchIndexies) {
      macros.error('Error, missing arguments.', !!employeeMap, !!employeeSearchIndex, !!termDumps, !!searchIndexies);
      return null;
    }


    return new this(employeeMap, employeeSearchIndex, termDumps, searchIndexies);
  }

  onInterval() {
    // Purge the older half of the items in the cache and purge all items that are over a day old.

    // First figure out how old the average item in the cache is

    let cacheNum = 0;
    let cacheAgeTotal = 0;

    const keys = Object.keys(this.refCache);
    const now = Date.now();
    const dayAgo = Date.now() - 86400000;

    // Move (by reference) all the items that we want to keep to a new object.
    const newCache = {};

    for (const key of keys) {
      // the .time check was failing (cannot read .time of undefined) in some really weird cases...
      // not totally sure why but it is an easy fix.
      // https://rollbar.com/ryanhugh/searchneu/items/32/
      // and noticed a bunch of times in dev too.
      if (!this.refCache[key]) {
        continue;
      }

      cacheNum++;
      cacheAgeTotal += now - this.refCache[key].time;
    }

    let numKeeping = 0;
    const avgAge = cacheAgeTotal / cacheNum;

    // Clear out any cache that has not been used in over a day.
    for (const key of keys) {
      if (!this.refCache[key]) {
        continue;
      }

      const cacheItemTime = this.refCache[key].time;

      if (cacheItemTime > dayAgo && now - cacheItemTime < avgAge) {
        newCache[key] = this.refCache[key];
        numKeeping++;
      }
    }

    macros.log('There were ', cacheNum, 'items in cache and keeping', numKeeping, '.');

    this.refCache = newCache;
    this.itemsInCache = numKeeping;
  }

  checkForSubjectMatch(searchTerm, termId) {
    // This is O(n) where n is the number of subjects in a term, but because there are so few subjects it usually takes < 1ms
    // If the search term starts with a subject (eg cs2500), put a space after the subject
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const subjects = this.dataLib.getSubjects(termId);

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const lowerCaseSubject = subject.subject.toLowerCase();
      const lowerCaseText = subject.text.toLowerCase();

      // Perfect match for a subject, list all the classes in the subject
      if (lowerCaseSubject === lowerCaseSearchTerm || lowerCaseSearchTerm === lowerCaseText) {
        macros.log('Perfect match for subject!', subject.subject);

        const results = this.dataLib.getClassesInSubject(subject.subject, termId);

        const output = [];
        results.forEach((result) => {
          output.push({
            score: 0,
            ref: result,
            type: 'class',
          });
        });

        // object that holds subject name, count, wasSubjectMatch, results
        const returnable = {
          subjectCount: output.length,
          subjectName: subject.text,
          results: output,
        };

        return returnable;
      }
    }
    return null;
  }

  // Internal use only.
  // Given a refs, minIndex and a maxIndex it will return the new minIndex and maxIndex that includes all results that have score that match scores that
  // are included in refs. The given refs array must be sorted.
  static expandRefsSliceForMatchingScores(refs, minIndex, maxIndex) {
    while (minIndex > 0 && refs[minIndex].score === refs[minIndex - 1].score) {
      minIndex--;
    }

    // If the max index is greater than the number of refs, just sort all the refs.
    if (refs.length <= maxIndex) {
      maxIndex = refs.length - 1;
    }

    // Same thing for the end.
    while (refs[maxIndex + 1] && refs[maxIndex + 1].score === refs[maxIndex].score) {
      maxIndex++;
    }

    return {
      minIndex: minIndex,
      maxIndex: maxIndex,
    };
  }


  static getBusinessScore(object) {
    if (object.type === 'class') {
      if (object.sections.length === 0) {
        return 0;
      }

      // Find the number of taken seats.
      let takenSeats = 0;
      for (const section of object.sections) {
        takenSeats += section.seatsCapacity - section.seatsRemaining;

        // Also include the number of seats on the waitlist, if there is a waitlist.
        if (section.waitCapacity !== undefined && section.waitRemaining !== undefined) {
          takenSeats += section.waitCapacity - section.waitRemaining;
        }
      }

      // If there are many taken seats, there is clearly an interest in the class.
      // Rank these the highest.
      if (takenSeats > 0) {
        return takenSeats + 1000000;
      }

      // Rank these higher than classes with no sections, but less than everything else.
      if (!macros.isNumeric(object.class.classId)) {
        return 1;
      }


      const classNum = parseInt(object.class.classId, 10);

      // I haven't seen any that are over 10k, but just in case log a waning and clamp it.
      if (classNum > 10000) {
        macros.log('Warning: class num', classNum, ' is over 10k', object.class.classId);
        return 2;
      }

      return 10000 - classNum;
    }
    if (object.type === 'employee') {
      return Object.keys(object.employee).length;
    }

    macros.error('Yooooooo omg y', object);
    return 0;
  }

  // Takes in a list of search result objects
  // and sorts the ones with matching scores in place by the business metric.
  // In other works, if the scores match for a bunch of objects, it will sort then based on the business metric.
  // If the scores do not match, it will leave them sorted by score.
  static sortObjectsAfterScore(objects) {
    let index = 0;
    while (index < objects.length) {
      const currentChunk = [objects[index]];
      const startIndex = index;
      while (index + 1 < objects.length && objects[index].score === objects[index + 1].score) {
        currentChunk.push(objects[index + 1]);
        index++;
      }

      currentChunk.sort((a, b) => {
        const aScore = this.getBusinessScore(a);
        const bScore = this.getBusinessScore(b);
        if (aScore >= bScore) {
          return -1;
        }

        if (aScore === bScore) {
          return 0;
        }

        return 1;
      });

      for (let i = 0; i < currentChunk.length; i++) {
        objects[startIndex + i] = currentChunk[i];
      }

      index++;
    }

    return objects;
  }


  // Main search function. The min and max index are used for pagenation.
  // Eg, if you want results 10 through 20, call search('hi there', 10, 20)
  // Return both the number of results and the results the user is looking for
  // The total number of results is returned for analytics.
  search(searchTerm, termId, minIndex = 0, maxIndex = 1000) {
    if (maxIndex <= minIndex) {
      macros.error('Error. Max index < Min index.', minIndex, maxIndex, maxIndex <= minIndex, typeof maxIndex, typeof minIndex);
      return {
        results: [],
        analytics: {
          status: 'Index range error',
          wasSubjectMatch: false,
          isCacheHit: false,
          query: searchTerm,
          minIndex: minIndex,
          maxIndex: maxIndex,
          resultCount: 0,
        },
      };
    }

    if (!this.dataLib.hasTerm(termId)) {
      macros.log('Invalid termId', termId, searchTerm);
      return {
        results: [],
        analytics: {
          status: 'Invalid termId',
          wasSubjectMatch: false,
          isCacheHit: false,
          query: searchTerm,
          minIndex: minIndex,
          maxIndex: maxIndex,
          termId: termId,
          resultCount: 0,
        },
      };
    }
    // Searches are case insensitive.
    searchTerm = searchTerm.trim().toLowerCase();

    // Replace some slang with the meaning of the words.
    // Hard coding isn't a great way to do this, but there is no better way than this lol
    // Acronyms such as ood and ai and ml are generated dynamically based on the name
    const slangMap = {
      fundies: 'fundamentals of computer science',
      orgo: 'Organic Chemistry',
      chemistry: 'chem',

      // Searching for numerica or numeri has no results
      // Lets show the same results as just searching for numerical
      // https://github.com/ryanhugh/searchneu/pull/19
      numerica: 'numerical',
      numeri: 'numerical',
    };

    for (const word in slangMap) {
      // Swap out a word if it matches the entire query or there are words after
      // Don't match if it is part of the first word (Ex. numeri and numerica should not both match numerical)
      if (searchTerm.startsWith(`${word} `) || searchTerm === word) {
        searchTerm = `${slangMap[word]} ${searchTerm.slice(word.length)}`;
      }
    }

    let wasSubjectMatch = false;
    const cacheEntry = this.refCache[termId + searchTerm];

    // Cache the refs.
    let refs;
    let subCount;
    let subName;
    if (cacheEntry) {
      refs = this.refCache[termId + searchTerm].refs;
      wasSubjectMatch = this.refCache[termId + searchTerm].wasSubjectMatch;
      // if (wasSubjectMatch) {
      //     const possibleSubjectMatch = this.checkForSubjectMatch(searchTerm, termId);
      //     subCount = possibleSubjectMatch.subjectCount;
      //     subName = possibleSubjectMatch.subjectName;

      // }

      // Update the timestamp of this cache item.
      this.refCache[termId + searchTerm].time = Date.now();
    } else {
      const possibleSubjectMatch = this.checkForSubjectMatch(searchTerm, termId);
      if (possibleSubjectMatch) {
        refs = possibleSubjectMatch.results;
        subCount = possibleSubjectMatch.subjectCount;
        subName = possibleSubjectMatch.subjectName;
        wasSubjectMatch = true;
      } else {
        refs = this.getRefs(searchTerm, termId);
      }

      this.itemsInCache++;

      this.refCache[termId + searchTerm] = {
        refs: refs,
        wasSubjectMatch: wasSubjectMatch,
        subjectName: subName,
        subjectCount: subCount,
        time: Date.now(),
      };
    }

    const analytics = {
      status: 'Success',
      wasSubjectMatch: wasSubjectMatch,
      subjectCount: subCount,
      subjectName: subName,
      isCacheHit: !!cacheEntry,
      query: searchTerm,
      minIndex: minIndex,
      maxIndex: maxIndex,
      resultCount: refs.length,
    };


    // Check the cache when over 10,000 items are added to the cache
    if (this.itemsInCache > 10000) {
      macros.log('Purging the cache because too many items are in the cache.');

      // Wait until the next tick because the first priority is to respond to the search query.
      setTimeout(() => {
        this.onInterval();
      }, 0);
    }

    // If there are no results, log an event to Amplitude.
    if (refs.length === 0) {
      macros.logAmplitudeEvent('Backend No Search Results', {
        query: searchTerm.toLowerCase(),
      });
    }

    // If there were no results or asking for a range beyond the results length, stop here.
    if (refs.length === 0 || minIndex >= refs.length) {
      return {
        results: [],
        analytics: analytics,
      };
    }

    // We might need to load more data than we are going to return
    // Keep track of how many more we added in the beginning so we can skip those when returning the results.
    // Also keep track of how many items we are going to return.
    // One possible tweak to this code is to not sort past index 50.
    // The order of results past this don't really matter that much so we really don't need to sort them.

    // Step 1: Figure out what items we need to load.
    const returnItemCount = maxIndex - minIndex;

    const originalMinIndex = minIndex;

    // Don't re-order based on business score if there was a subject match.
    if (!wasSubjectMatch) {
      const newMaxAndMinIndex = this.constructor.expandRefsSliceForMatchingScores(refs, minIndex, maxIndex);
      minIndex = newMaxAndMinIndex.minIndex;
      maxIndex = newMaxAndMinIndex.maxIndex;
    }

    // Discard this many items from the beginning of the array before they are returned to the user.
    // They are only included here because these specific items have the same score and may be sorted into the section that the user is requesting.
    const startOffset = originalMinIndex - minIndex;

    // Step 2: Load those items.
    let objects = [];
    const slicedRefs = refs.slice(minIndex, maxIndex + 1);
    for (const ref of slicedRefs) {
      if (ref.type === 'class') {
        const aClass = this.dataLib.getClassServerDataFromHash(ref.ref);

        if (!aClass) {
          macros.error('yoooooo omg', ref);
        }

        const sections = [];

        if (aClass.crns) {
          for (const crn of aClass.crns) {
            const sectionKey = Keys.create({
              host: aClass.host,
              termId: aClass.termId,
              subject: aClass.subject,
              classId: aClass.classId,
              crn: crn,
            }).getHash();

            if (!sectionKey) {
              macros.error('Error no hash', crn, aClass);
            }

            sections.push(this.dataLib.getSectionServerDataFromHash(sectionKey));
          }
        }

        objects.push({
          score: ref.score,
          type: ref.type,
          class: aClass,
          sections: sections,
        });
      } else if (ref.type === 'employee') {
        objects.push({
          score: ref.score,
          employee: this.employeeMap[ref.ref],
          type: ref.type,
        });
      } else {
        macros.error('unknown type!');
      }
    }


    if (!wasSubjectMatch) {
      // Sort the objects by chunks that have the same score.
      objects = this.constructor.sortObjectsAfterScore(objects);
    }


    return {
      results: objects.slice(startOffset, startOffset + returnItemCount),
      analytics: analytics,
    };
  }


  // This returns an object like {ref: 'neu.edu/201810/CS/...' , type: 'class'}
  getRefs(searchTerm, termId) {
    // This is O(n), but because there are so few subjects it usually takes < 1ms
    // If the search term starts with a subject (eg cs2500), put a space after the subject
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const subjects = this.dataLib.getSubjects(termId);

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const lowerCaseSubject = subject.subject.toLowerCase();

      if (lowerCaseSearchTerm.startsWith(lowerCaseSubject)) {
        const remainingSearch = searchTerm.slice(lowerCaseSubject.length);

        // Only rewrite the search if the rest of the query has a high probability of being a classId.
        if (remainingSearch.length > 5) {
          break;
        }
        const match = remainingSearch.match(/\d/g);

        if (!match || match.length < 3) {
          break;
        } else {
          searchTerm = `${searchTerm.slice(0, lowerCaseSubject.length)} ${searchTerm.slice(lowerCaseSubject.length)}`;
        }
        break;
      }
    }

    // Check to see if the search is for an email, and if so remove the @northeastern.edu and @neu.edu
    searchTerm = searchTerm.replace(/@northeastern\.edu/gi, '').replace(/@neu\.edu/gi, '');


    // Returns an array of objects that has a .ref and a .score
    // The array is sorted by score (with the highest matching closest to the beginning)
    // eg {ref:"neu.edu/201710/ARTF/1123_1835962771", score: 3.1094880801464573}
    const classResults = this.searchIndexies[termId].search(searchTerm, classSearchConfig);

    const employeeResults = this.employeeSearchIndex.search(searchTerm, employeeSearchConfig);

    const output = [];

    // This takes no time at all, never more than 2ms and usually <1ms
    while (true) {
      if (classResults.length === 0 && employeeResults.length === 0) {
        break;
      }

      if (classResults.length === 0) {
        output.push({
          type: 'employee',
          ref: employeeResults[0].ref,
          score: employeeResults[0].score,
        });
        employeeResults.splice(0, 1);
        continue;
      }

      if (employeeResults.length === 0) {
        output.push({
          type: 'class',
          ref: classResults[0].ref,
          score: classResults[0].score,
        });

        classResults.splice(0, 1);
        continue;
      }

      if (classResults[0].score > employeeResults[0].score) {
        output.push({
          type: 'class',
          ref: classResults[0].ref,
          score: classResults[0].score,
        });
        classResults.splice(0, 1);
        continue;
      }

      if (classResults[0].score <= employeeResults[0].score) {
        output.push({
          type: 'employee',
          ref: employeeResults[0].ref,
          score: employeeResults[0].score,
        });
        employeeResults.splice(0, 1);
      }
    }

    return output;
  }
}

export default Search;
