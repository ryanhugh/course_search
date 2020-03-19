import React from 'react';
import _ from 'lodash';
import NUPathFilter from './NUPathFilter';
import { FilterOptions } from './filterTypes';
import { FilterSelection } from '../types';

export interface FilterPanelProps {
  options: FilterOptions,
  active: FilterSelection,
  setActive: (f: FilterSelection) => void,
}

function FilterPanel({ options, active, setActive }: FilterPanelProps) {
  return (
    <NUPathFilter
      options={ options.NUpath }
      active={ active.NUpath }
      setActive={ (a) => setActive({ NUpath: a }) }
    />
  );
}

export default React.memo(FilterPanel, _.isEqual);