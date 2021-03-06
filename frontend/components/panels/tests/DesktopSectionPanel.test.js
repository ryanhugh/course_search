/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import React from 'react';

import Enzyme, { shallow } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

import mockData from './mockData';
import DesktopSectionPanel from '../DesktopSectionPanel';

Enzyme.configure({ adapter: new Adapter() });

it('should render a section', () => {
  const result = shallow(<DesktopSectionPanel shouldShowExamColumns={ false } showWaitList={ false } showHonorsColumn={ false } section={ mockData.cs1210.sections[0] } showNotificationSwitches={ false } />);
  expect(result).toMatchSnapshot();
});

it('should render another section', () => {
  const result = shallow(<DesktopSectionPanel shouldShowExamColumns={ false } showWaitList={ false } showHonorsColumn={ false } section={ mockData.cs1210.sections[1] } showNotificationSwitches={ false } />);
  expect(result).toMatchSnapshot();
});

it('should render a section w/ notif check boxes', () => {
  const result = shallow(<DesktopSectionPanel shouldShowExamColumns={ false } showWaitList={ false } showHonorsColumn={ false } section={ mockData.cs1210.sections[0] } showNotificationSwitches />);
  expect(result).toMatchSnapshot();
});
