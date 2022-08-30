import "core-js/features/url";

class ChapterListItem {
    number = "";
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title = "";
    // Name is the short title of the chapter.
    // 
    description = "";
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier = "";
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group = null
    // Optional: Scanalation group if one exists.
    // 
    variant = null
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created = null;
    // Optional: Date created as a string if it exists.

    created = null;
    // Optional: Date updated as a string if it exists.

    published = null;
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = null,
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }) {
        this.number = number;
        this.identifier = identifier;
        this.title = title;
        this.description = description;
        this.group = group;
        this.variant = variant;
        this.created = created;
        this.updated = updated;
        this.published = published;
    }
}

class ChapterList {
    chapters = [];
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }) {
        this.chapters = chapters;
    }
}

class ChapterData {
    pageUrls = [];
    // PageUrls contains all the page urls for the chapter.

    constructor({ pageUrls }) {
        this.pageUrls = pageUrls;
    }
}

class MangaSeries {
    name = "";
    // Name is the name of the manga series.
    // 
    identifier = "";
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    ranking = -1;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    // 
    coverUrl = null;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.

    constructor({ name, identifier, ranking = -1, coverUrl = null }) {
        this.name = name;
        this.identifier = identifier;
        this.ranking = ranking;
        this.coverUrl = coverUrl;
    }
}

class MangaSeriesList {
    results = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }) {
        this.results = results;
    }

    addResult({ name, identifier, ranking = -1 }) {
        this.results.push(MangaSeries({ name, identifier }));
    }
}

export let EXTENSION_ID="596453e3-9ddf-4370-b131-26e1ff414c72";

const apiBaseUrl = "https://api.mangapark.org/apo/";

const searchQuery = `
query get_content_browse_search($select: ComicSearchSelect) {
  get_content_browse_search(select: $select) {
    reqPage
    reqSize
    reqSort
    reqWord
    paging {
      total
      pages
      page
      size
      skip
    }
    items {
      data {
        id
        dbStatus
        isNormal
        isHidden
        isDeleted
        dateCreate
        datePublic
        dateModify
        dateUpload
        dateUpdate
        name
        slug
        altNames
        authors
        artists
        readDirection
        urlPath
        imageCoverUrl
        urlCover600
        urlCover300
        urlCoverOri
      }
    }
  }
}
`;

const listChaptersQuery = `
query get_content_comicChapterRangeList($select: Content_ComicChapterRangeList_Select) {
  get_content_comicChapterRangeList(select: $select) {
    reqRange {
      x
      y
    }
    missing
    pager {
      x
      y
    }
    items {
      serial
      chapterNodes {
        id
        data {
          id
          dbStatus
          isNormal
          isHidden
          isDeleted
          isFinal
          dateCreate
          datePublic
          dateModify
          lang
          volume
          serial
          dname
          title
          srcTitle
        }
      }
    }
  }
}
`;

const getChapterQuery = `
query get_content_chapter_node($id: ID!) {
  get_content_chapter_node(id: $id) {
    data {
      imageSet {
        httpLis
        wordLis
      }
    }
  }
}
`;

export async function searchManga(seriesName, offset=0, limit=10) {
    console.debug("searchManga called.");

    let response = await fetch(
        apiBaseUrl,
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: searchQuery,
                variables: {
                    select: {
                        word: seriesName
                    }
                }
            })
        }
    );
    let json = await response.json();

    // TODO: Should handle pagination
    
    let results = json.data.items.map(({ data }) => {
        const id = data.id;

        let title = data.name;
        if (!title) {
            title = data.altNames[0];
        }
        if (!title) {
            console.log(
                "Couldn't determine proper title.",
                { raw_data: data }
            )
            return null;
        }

        const coverUrl = data.imageCoverUrl;

        return new MangaSeries({
            identifier: id,
            name: title,
            coverUrl: coverUrl,
        })
    }).filter(x => x);

    return new MangaSeriesList({
        results: results,
    });
}

export async function listChapters(
    seriesIdentifier, offset=0, limit=500, since=null, order='asc'
) {
    let response = await fetch(
        apiBaseUrl,
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: listChaptersQuery,
                variables: {
                    select: {
                        comicId: seriesIdentifier
                    }
                }
            })
        }
    );
    let json = await response.json();

    if(json.data.length == 0) {
        console.log(`No new chapters found for series.`, { id: seriesIdentifier });
        return ChapterList({
            chapters: [],
        })
    }

    let chapters = [];
    for (result of json.data.get_content_comicChapterRangeList.items) {
        const number = result.serial;
        const filtered = result.chapterNodes.filter(x => x.data.lang.toLowerCase() == "en");
        let instances = filtered.map(chap => {
            const id = chap.id;
            const {
                dname: title,
                dateCreate: created,
                dateModify: updated,
                srcTitle: variant
            } = chap.data;

            let chapItem = new ChapterListItem({
                identifier: id,
                title,
                number,
                variant,
                created,
                updated,
            });
            console.debug(`Creating final ChapterListItem`, chapItem);
            return chapItem;
        });
        chapters.push(...instances);
    };

    console.debug(`Creating final chapter list.`, { chapters });
    const chapList = new ChapterList({
        chapters: chapters,
    });

    return chapList;
}

export async function getChapter(chapterIdentifier) {
        let response = await fetch(
        apiBaseUrl,
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: getChapterQuery,
                variables: {
                    id: chapterIdentifier
                }
            })
        }
    );
    let json = await response.json();
    const pageUrls = json.map((url, word) => (
        `${url}?${word}`
    ));

    return new ChapterData({ pageUrls });
}
