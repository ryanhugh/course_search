/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import addPreRequisiteFor from '../addPreRequisiteFor';
import Keys from '../../../../../common/Keys';

describe('addPreRequisiteFor tests', () => {
  const cs2500 = {
    classId: '2500',
    termId: '201829',
    host: 'neu.edu',
  };

  const cs2510 = {
    prereqs: {
      type: 'or',
      values: [{
        subject: 'CS',
        classUid: '2500_699845913',
        classId: '2500',
      }],
    },
    coreqs: {
      type: 'or',
      values: [{
        subject: 'CS',
        classUid: '2511_803118792',
        classId: '2511',
      }],
    },
    classId: '2510',
    termId: '201830',
    subject: 'CS',
  };

  const termDump = {
    classes: [cs2500, cs2510],
    sections: [],
  };

  it('should load in termDump', () => {
    addPreRequisiteFor.termDump = termDump;
    expect(addPreRequisiteFor.termDump).toBe(termDump);
  });

  describe('parseClass tests', () => {
    const outputPreReqClass = cs2500;
    outputPreReqClass.prereqsFor = [];
    outputPreReqClass.prereqsFor.push(cs2510);

    // it('should create a prerequsites field and add the class, if one doesn\'t exist', () => {
    //   addPreRequisiteFor.parseClass(cs2510, cs2500, 'and');

    //   const find = Keys.create(cs2500).getHash();
    //   let found = {};
    //   for (const aClass of termDump.classes) {
    //     if (Keys.create(aClass).getHash() === find) {
    //       found = aClass;
    //     }
    //   }
    //   expect(found).toBe(outputPreReqClass);
    // });

    // it('should add a new class to an already existing class', () => {
    //   addPreRequisiteFor.parseClass(cs2510, cs2500, 'and');
    //   outputPreReqClass.prereqsFor.push(cs2510);

    //   const find = Keys.create(cs2500).getHash();
    //   let found = {};
    //   for (const aClass of termDump.classes) {
    //     if (Keys.create(aClass).getHash() === find) {
    //       found = aClass;
    //     }
    //   }
    //   console.log(found);
    //   console.log(outputPreReqClass);

    //   expect(found).toEqual(outputPreReqClass);
    // });
  });
});
