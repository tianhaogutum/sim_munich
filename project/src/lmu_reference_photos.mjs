// Six locally cached real photographs, each with independent attribution and license.
// Full provenance and hashes: assets/reference_photos/sources.json.
export const REFERENCE_PHOTOS = Object.freeze([
  {
    "district": "ludwigstrasse",
    "title": "LMU 主楼与路德维希大街",
    "file": "ludwigstrasse.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:2017_LMU_1-4_rectlinear.jpg",
    "author": "Wikiolo; panorama / derivative work: Martin Kraft",
    "license": "CC BY-SA 3.0",
    "license_url": "https://creativecommons.org/licenses/by-sa/3.0",
    "date": "2017-02-27",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  },
  {
    "district": "siegestor",
    "title": "凯旋门",
    "file": "siegestor.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:Muenchen_Siegestor01.jpg",
    "author": "Bbb",
    "license": "CC BY-SA 1.0",
    "license_url": "https://creativecommons.org/licenses/by-sa/1.0",
    "date": "2007-07",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  },
  {
    "district": "huberplatz",
    "title": "Georgianum 与胡贝尔广场",
    "file": "huberplatz.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:Georgianum_M%C3%BCnchen_Professor-Huber-Platz_(1).jpg",
    "author": "Ricardalovesmonuments",
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0",
    "date": "2025-03-02 15:19:52",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  },
  {
    "district": "ludwig_west",
    "title": "Philologicum 历史立面",
    "file": "ludwig_west.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:LMU-Philologicum_Fassade_Ludwigstra%C3%9Fe.jpg",
    "author": "UB der LMU München",
    "license": "CC BY-SA 3.0 de",
    "license_url": "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    "date": "2019-09",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  },
  {
    "district": "maxvorstadt_west",
    "title": "阿玛莉恩街历史立面",
    "file": "maxvorstadt_west.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:Amalienstr._40_Muenchen-1.jpg",
    "author": "Rufus46",
    "license": "CC BY-SA 3.0",
    "license_url": "https://creativecommons.org/licenses/by-sa/3.0",
    "date": "2012-05-17",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  },
  {
    "district": "ludwigskirche",
    "title": "圣路德维希教堂",
    "file": "ludwigskirche.jpg",
    "source_page": "https://commons.wikimedia.org/wiki/File:Mueludwigk032025zob.jpg",
    "author": "Fentriss",
    "license": "CC0",
    "license_url": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "date": "2025-03-16",
    "changes": "Wikimedia-generated 960 px thumbnail; displayed without pixel edits."
  }
].map(photo => Object.freeze({...photo,
  src: new URL(`../assets/reference_photos/${photo.file}`, import.meta.url).href,
})));
export const photoForDistrict = district => REFERENCE_PHOTOS.find(photo => photo.district === district) ?? null;

export function createReferencePhoto(container) {
  if (!document.querySelector('link[data-lmu-reference-photos]')) {
    const sheet = document.createElement('link'); sheet.rel = 'stylesheet';
    sheet.href = new URL('./lmu_reference_photos.css', import.meta.url).href;
    sheet.dataset.lmuReferencePhotos = ''; document.head.append(sheet);
  }
  const figure = document.createElement('figure'); figure.className = 'lw-reference';
  const heading = document.createElement('div'); heading.className = 'lw-reference-heading'; heading.textContent = '实景对照 · 街区参考';
  const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer';
  const image = document.createElement('img'); image.className = 'lw-reference-image'; image.loading = 'lazy'; image.decoding = 'async'; link.append(image);
  const caption = document.createElement('figcaption');
  const title = document.createElement('span'); title.className = 'lw-reference-title';
  const credit = document.createElement('span'); credit.className = 'lw-reference-credit';
  const license = document.createElement('a'); license.target = '_blank'; license.rel = 'noopener noreferrer';
  const note = document.createElement('small'); note.textContent = '照片为拍摄时的实景；模型的高度、细部与季节有简化。';
  caption.append(title, credit, document.createTextNode(' · '), license, note);
  figure.append(heading, link, caption); container.append(figure);
  image.onerror = () => { image.hidden = true; title.textContent += '（照片暂不可用，点击来源查看）'; };
  return {
    update(district) {
      const photo = photoForDistrict(district); figure.hidden = !photo;
      if (!photo) return;
      image.hidden = false; image.alt = `${photo.title}，实景参考照片`;
      if (image.src !== photo.src) image.src = photo.src;
      link.href = photo.source_page; link.setAttribute('aria-label', `查看实景原图与说明：${photo.title}`);
      title.textContent = photo.title; credit.textContent = photo.author;
      license.textContent = photo.license; license.href = photo.license_url;
    },
    dispose() { figure.remove(); },
  };
}
