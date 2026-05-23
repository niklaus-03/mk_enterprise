import React from 'react';

export const isHindi = (text) => {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(text);
};

export const titleCase = (str) => {
  if (!str) return '';
  return str.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

export const parseCustomerNameFull = (fullName) => {
  if (!fullName) return { prefix: '', name: '', suffix: '' };
  
  const prefixes = ['Shree', 'Shreemati', 'Mr.', 'Mrs.', 'Ms.', 'श्री', 'श्रीमती'];
  const suffixes = ['jii', 'ji', 'जी'];
  
  let prefix = '';
  let name = fullName.trim();
  let suffix = '';
  
  for (const p of prefixes) {
    if (name.toLowerCase().startsWith(p.toLowerCase() + ' ')) {
      prefix = name.slice(0, p.length).trim();
      name = name.slice(p.length + 1).trim();
      break;
    }
  }
  
  for (const s of suffixes) {
    if (name.toLowerCase().endsWith(' ' + s.toLowerCase())) {
      suffix = name.slice(name.length - s.length).trim();
      name = name.slice(0, name.length - s.length - 1).trim();
      break;
    }
  }
  
  return { prefix, name, suffix };
};

export const FormattedName = ({ fullName, style = {}, className = "" }) => {
  const { prefix, name, suffix } = parseCustomerNameFull(fullName);
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', ...style }}>
      {prefix && <span style={{ fontWeight: 400, opacity: 0.85 }}>{prefix}</span>}
      <span style={{ fontWeight: 'inherit' }}>{name || fullName}</span>
      {suffix && <span style={{ fontWeight: 400, opacity: 0.85 }}>{suffix}</span>}
    </span>
  );
};

export const parseCustomerName = (fullName) => {
  if (!fullName) return { prefix: 'Shree', name: '' };
  
  const prefixes = ['Shree', 'Shreemati', 'Mr.', 'Mrs.', 'Ms.', 'श्री', 'श्रीमती'];
  let matchedPrefix = null;
  let name = fullName.trim();
  
  for (const p of prefixes) {
    if (name.startsWith(p + ' ')) {
      matchedPrefix = p;
      name = name.slice(p.length + 1).trim();
      break;
    }
  }
  
  return { 
    prefix: matchedPrefix || (isHindi(fullName) ? 'श्री' : 'Shree'), 
    name 
  };
};

export const formatCustomerName = (prefix, nameRaw) => {
  if (!nameRaw) return '';
  let name = titleCase(nameRaw.trim());
  if (!prefix || prefix === 'Other') return name;
  return `${prefix} ${name}`;
};

export const getPrefixOptions = (name) => {
  const isH = isHindi(name);
  if (isH) {
    return [
      { value: 'श्री', label: 'श्री' },
      { value: 'श्रीमती', label: 'श्रीमती' },
      { value: 'Other', label: 'Other (None)' }
    ];
  }
  return [
    { value: 'Shree', label: 'Shree' },
    { value: 'Shreemati', label: 'Shreemati' },
    { value: 'Other', label: 'Other (None)' }
  ];
};

export const applyAutoSuffix = (nameRaw) => {
  let name = titleCase((nameRaw || '').trim());
  if (!name) return name;
  
  const isH = isHindi(name);
  const endsWithJi = /ji$|jii$|जी$/i.test(name);
  
  if (!endsWithJi) {
    if (isH) {
      name = name + ' जी';
    } else {
      name = name + ' jii';
    }
  }
  return name;
};
