import "core-js/features/url";

class ChapterListItem {
    number: string;
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title: string;
    // Name is the short title of the chapter.
    // 
    description: string;
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier: string;
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group: ?string
    // Optional: Scanalation group if one exists.
    // 
    variant: ?string
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created: ?Date
    // Optional: Date created as a string if it exists.

    updated: ?Date
    // Optional: Date updated as a string if it exists.

    published: ?Date
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = "",
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }: {
        number: string,
        identifier: string,
        title: string,
        description?: string,
        group?: ?string,
        variant?: ?string,
        created?: ?Date,
        updated?: ?Date,
        published?: ?Date,
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
    chapters: Array<ChapterListItem>;
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }: { chapters: Array<ChapterListItem> }) {
        this.chapters = chapters;
    }
}


type PageDataHandler = (string) => (string);

class PageData {
    version: string = "1.0.0"
    highUrl: string
    lowUrl: ?string
    highHandler: ?PageDataHandler
    lowHandler: ?PageDataHandler

    constructor({
        highUrl,
        lowUrl = null,
        highHandler = null,
        lowHandler = null,
    }: {
        highUrl: string,
        lowUrl?: ?string,
        highHandler?: ?PageDataHandler,
        lowHandler?: ?PageDataHandler,
    }) {
        this.highUrl = highUrl;
        this.lowUrl = lowUrl;
        this.highHandler = highHandler;
        this.lowHandler = lowHandler;
    }
}

class ChapterData {
    version: string = "2.0.0"

    pages: Array<PageData>

    constructor({ pages }: { pages: Array<PageData> }) {
        this.pages = pages
    }
}

class MangaSeries {
    name: string;
    // Name is the name of the manga series.
    // 
    identifier: string;
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    coverUrl: ?string;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.
    ranking: number;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    // 

    constructor({
        name,
        identifier,
        coverUrl = null,
        ranking = -1,
    }: {
        name: string,
        identifier: string,
        coverUrl?: ?string,
        ranking?: number,
    }) {
        this.name = name;
        this.identifier = identifier;
        this.coverUrl = coverUrl;
        this.ranking = ranking;
    }
}

class MangaSeriesList {
    results: Array<MangaSeries> = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }: { results: Array<MangaSeries> }) {
        this.results = results;
    }
}

export let EXTENSION_ID="596453e3-9ddf-4370-b131-26e1ff414c72";

const apiBaseUrl = "https://mangapark.org/apo/";

const searchQuery = `
query get_content_browse_search($select: SearchComic_Select) {
  get_searchComic(select: $select) {
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
        urlCover600
        urlCover300
        urlCoverOri
        tranLang
        chaps_normal
        chaps_others
      }
    }
  }
}
`;

const listChaptersQuery = `
query ($id: ID!) {
  get_comicChapterList(comicId: $id) {
    id
    data {
      dbStatus
      isFinal
      dateCreate
      datePublic
      dateModify
      lang
      volume
      serial
      dname
      title
      srcName
      srcTitle
    }
  }
}
`;

const getChapterQuery = `
query($id: ID!) {
  get_chapterNode(id: $id) {
    data {
      imageFile {
        urlList
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
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                query: searchQuery,
                variables: {
                    select: {
                        word: seriesName,
                        incTLangs: ["en"]
                    }
                }
            })
        }
    );
    let json = await response.json();

    // TODO: Should handle pagination
    let results = json.data.get_searchComic.items.filter(({ data }) => {
        let hasChapters = (data.chaps_normal > 0) || (data.chaps_others > 0);
        if (!hasChapters) {
            console.debug("Skipping series without chapters.", {
                id: data.id
            });
        }
        return hasChapters;
    }).map(({ data }) => {
        console.debug("Processing chapter.", {
            data: JSON.stringify(data)
        })
        const id = data.id.toString();

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

        const coverUrl = data.urlCover300;

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
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                query: listChaptersQuery,
                variables: {
                    id: seriesIdentifier
                }
            })
        }
    );

    if(!response.ok) {
        let respText = ""
        try {
            respText = await response.text;
        } catch {}

        throw new Error(`Bad response from server: ${response.status} - ${response.statusText}\n${respText}`);
    }

    let json = await response.json();

    try {
        if(json.data.get_comicChapterList == null) {
            throw "Empty response."
        }

        const bodyLength = json.data.get_comicChapterList.length

        if(bodyLength == 0) {
            throw "No chapters returned."
        }
    } catch (error) {
        console.log("Couldn't retrieve any chapters.", {
            identifier: seriesIdentifier,
            error: error,
            body: json
        })

        throw error
    }

    let chapters = [];
    for (let {id, data} of json.data.get_comicChapterList) {
        const number = data.serial.toString();
        // NOTE: I think that they may be removing the lang field in the future.
        //       It seems like a given series must be one language now.
        //
        if (data.lang && (data.lang.toLowerCase() != "en")) {
            continue;
        }

        const identifier = id.toString();
        const {
            dname: title,
            dateCreate: createdMs,
            dateModify: updatedMs,
            srcTitle: variant
        } = data;

        const created = new Date(createdMs);
        const updated = new Date(updatedMs);

        let chapItem = new ChapterListItem({
            identifier,
            title,
            number,
            variant,
            created,
            updated,
        });
        console.debug(`Creating chapter.`, chapItem);

        chapters.push(chapItem);
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
                "Content-Type": "application/json",
                "Accept": "application/json",
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

    const pageUrls = json.data.get_chapterNode.data.imageFile.urlList;
    const pages = pageUrls.map((url) => (
        new PageData({ highUrl: url })
    ));

    return new ChapterData({ pages });
}
