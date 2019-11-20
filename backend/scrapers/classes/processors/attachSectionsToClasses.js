/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import BaseProcessor from './baseProcessor';
import Keys from '../../../../common/Keys';
import macros from '../../../macros';

// Insert sections into the object for each class


class AttachSectionsToClasses extends BaseProcessor.BaseProcessor {
  go(termDump) {
    // decent solution:
    // 1. create a hash from classHash to index in class array
    // 2. for each section, insert class to sections in that object
    // 3. ezpz
    // 4. return whatever



    // Hashmap of all classes. Used to more quickly lookup classes
    const classMap = {};

    termDump.classes.forEach((aClass, index) => {
      const classHash = Keys.getClassHash(aClass);

      classMap[classHash] = index;
      aClass.sections = [];
    });

    // Sort sections by crn.
    // This will keep the sections the same between different scrapings.
    termDump.sections.sort((a, b) => {
      return a.crn > b.crn;
    });

    // Loop through all sections and associate them with the right class
    termDump.sections.forEach((section) => {
      const classHash = Keys.getClassHash({
        host: section.host,
        termId: section.termId,
        subject: section.subject,
        classId: section.classId,
      });

      if (!classMap[classHash]) {
        // This should never happen now that the bug has been fixed.
        macros.error('No class exists with same data?', classHash, section.url);
        return;
      }

      classMap[classHash].sections.push(section);
    });

    return Object.values(classMap);
  }
}

export default new AttachSectionsToClasses();
