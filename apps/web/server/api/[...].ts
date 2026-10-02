// Unknown API paths answer 404 as a problem document instead of falling through to the pages.
export default defineEventHandler(() => {
  throw problem(404, 'not_found', 'Diese API-Adresse gibt es nicht.')
})
