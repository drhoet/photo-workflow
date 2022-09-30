export default class TaggingService {

    constructor(backendService) {
        this.tags = null;
        this.loading = false;
        this.loaded = false;
        this.backendService = backendService;
    }

    load(reload) {
        if(!this.loading) {
            if(!this.loaded || reload) {
                this.loading = true;
                this.loadingPromise = fetch(`/main/api/tags`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then((res) => this.backendService.parseResponse(res, `Could not load tags`, true))
                    .then((json) => {
                        this.tags = this.#load('', json);
                        this.loading = false;
                        this.loaded = true;
                    });
            }
        }
        return this.loadingPromise;
    }

    #load(prefix, tagList) {
        let result = [];
        for(let tag of tagList) {
            let mapped = {
                searchName: tag.name.toLowerCase(),
                tag: {
                    id: tag.id,
                    name: tag.name,
                    full_name: prefix + tag.name,
                }
            };
            if(tag.subtags) {
                mapped.subtags = this.#load(prefix + tag.name + '/', tag.subtags);
            }
            result.push(mapped);
        }
        return result;
    }

    #filterSection(tags, searchText) {
        return tags.filter(el => el.searchName.includes(searchText))
            .flatMap(el => el.subtags);
    }

    #search(tags, searchText) {
        let result = []
        for(let t of tags) {
            if(searchText === '*' || t.searchName.includes(searchText)) {
                result.push(t.tag);
                if(t.subtags && t.subtags.length > 0) {
                    // we want to add the whole children-tree here
                    result = result.concat(this.#search(t.subtags, '*'));
                }
            } else if (t.subtags && t.subtags.length > 0) {
                // even if the tag does not match, we still want to see if maybe the children match
                result = result.concat(this.#search(t.subtags, searchText));
            }
        }
        return result;
    }

    find(searchText) {
        if(!this.loaded) {
            return [];
        }
        const sections = searchText.split('/');
        let filtered = this.tags;
        for(let s = 0; s < sections.length - 1; ++s) {
            filtered = this.#filterSection(filtered, sections[s]);
        }
        let result = this.#search(filtered, sections[sections.length - 1]);
        return result;
    }

}