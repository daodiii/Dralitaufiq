/**
 * schema.org data (JSON-LD) that says who the site is about, shared by the pages that need it.
 *
 * The home page carries the whole Person and the WebSite; every other page points at the Person by
 * its @id (`<site>/#person`), so search engines join the books, the lectures and the man into one
 * entity instead of meeting a new, thinner "Ali Mohamed Salah" on each page.
 */
import profile from '../data/profile.json';

export const siteUrl = (site: URL | undefined) => new URL('/', site).href;
export const personId = (site: URL | undefined) => `${siteUrl(site)}#person`;
export const websiteId = (site: URL | undefined) => `${siteUrl(site)}#website`;

/** A reference to him from another page's data: the @id, with his name for readers that don't join. */
export const personRef = (site: URL | undefined) => ({ '@type': 'Person', '@id': personId(site), name: 'Ali Mohamed Salah' });

/** The whole Person, for the home page. `image` is a full URL to a portrait of him. */
export function person(site: URL | undefined, image: string) {
  const home = siteUrl(site);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(site),
    name: 'Ali Mohamed Salah',
    honorificPrefix: 'Prof. Dr.',
    alternateName: [profile.name, profile.nameArabic, profile.nameSomali],
    url: home,
    image,
    description: profile.heroLede,
    jobTitle: 'Professor of Comparative Religion',
    worksFor: { '@type': 'Organization', name: 'Tawfiiq Islamic Centre', address: { '@type': 'PostalAddress', addressLocality: 'Oslo', addressCountry: 'NO' } },
    homeLocation: { '@type': 'Place', name: profile.city },
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'Islamic University of Madinah' },
      { '@type': 'CollegeOrUniversity', name: 'National University of Malaysia' },
    ],
    memberOf: profile.roles.filter((r) => r.org !== 'Tawfiiq Islamic Centre, Oslo').map((r) => ({ '@type': 'Organization', name: r.org })),
    knowsLanguage: profile.languages,
    knowsAbout: profile.fields.map((f) => f.en),
    sameAs: profile.social.map((s) => s.url),
  };
}

/** The WebSite, for the home page: its name, language and publisher. */
export function website(site: URL | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(site),
    url: siteUrl(site),
    name: profile.name,
    alternateName: profile.nameArabic,
    inLanguage: 'en',
    publisher: { '@id': personId(site) },
    about: { '@id': personId(site) },
  };
}
