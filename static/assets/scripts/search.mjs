import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';

console.log('Loading search');

// This initializes search using fuse.js
// The fuse file is hosted at ./search_index.en.json

const data = await fetch('/search_index.en.json').then(res => res.json());

const fuse = new Fuse(data, {
    includeScore: true,
    keys: ['title', 'description', 'body'],
});

console.log('Search initialized', fuse, data);

console.log(fuse.search('balanceOf'));
