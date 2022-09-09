import { parseResponse } from "./errorHandler.js";
import Cookies from "js-cookie";

export default {
    template: `
        <modal :showModal="showModal" @cancel="closeModal" :closable="false" :cancellable="false" :closeOnClickOutside="true" :loading="loading" id="image-carousel-modal">
            <template v-slot:body>
                <template v-if="!loading">
                    <section id="properties">
                        <section id="rating-overview">
                            <header>
                                <span>Rating</span>
                                <i class="mdi mdi-information-outline tooltip-symbol">
                                    <div class="tooltip-contents">
                                        Actual / recommended number of items for each rating.
                                        Since the number of items with 1<i class="mdi mdi-star"></i> has no recommendation, the value is just the actual number.<br/><br/>
                                        The last row in the table shows the total number of rated items in this directory.<br/><br/>
                                        The highlighted value is the current rating for this image.
                                    </div>
                                </i>
                            </header>
                            <table>
                                <tr v-for="(r, index) in ratingsOverview" :class="{active: currentlyShownItemHolder.item.rating === 5 - index}">
                                    <th class="mdi mdi-star">{{5 - index}}</th><td>{{r}}</td>
                                </tr>
                                <tr>
                                    <th class="mdi mdi-star"></th><td>{{ratedItemsCount}}</td>
                                </tr>
                            </table>
                        </section>
                    </section>
                    <section id="image">
                        <img :src="imageUrl" />
                    </section>
                    <section id="secondary-actions">
                        <button @click="toggleMetadata" :class="{active: showMetadata}"><div v-if="metadataLoading" class="spinner small">Loading...</div><i class="mdi mdi-information-outline"></i></button>
                    </section>
                    <section v-if="showMetadata" id="metadata">
                        <table v-for="metadataBlock in metadata">
                            <tr>
                                <th colspan=2>{{metadataBlock.header}}</th>
                            </tr>
                            <tr v-for="item in metadataBlock.items">
                                <td>{{item.key}}</td>
                                <td>{{item.value}}</td>
                            </tr>
                        </table>
                    </section>
                </template>
            </template>
        </modal>
    `,
    props: ['showModal', 'items', 'startImage'],
    emits: ['update:showModal'],
    computed: {
        imageUrl() {
            return this.imageCache[3].src; // always the middle element
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        onKeyDown(e) {
            if(this.showModal) {
                switch(e.key) {
                    case 'ArrowLeft':
                    case 'j':
                        this.showMetadata = false;
                        for(let i = this.imageCache.length - 1; i > 0; --i) {
                            this.imageCache[i] = this.imageCache[i - 1];
                        }
                        this.imageCache[0] = null;
                        this.currentlyShownItemHolder = this.currentlyShownItemHolder.prev;
                        this.loadCache();
                        break;
                    case 'ArrowRight':
                    case 'l':
                        this.showMetadata = false;
                        for(let i = 1; i < this.imageCache.length; ++i) {
                            this.imageCache[i - 1] = this.imageCache[i];
                        }
                        this.imageCache[this.imageCache.length - 1] = null;
                        this.currentlyShownItemHolder = this.currentlyShownItemHolder.next;
                        this.loadCache();
                        break;
                    case 'i':
                        this.toggleMetadata();
                        break;
                    case '0':
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                    case '5':
                    case '`':
                        let rating = (e.key === '`') ? 0: parseInt(e.key);
                        this.updateRating(this.currentlyShownItemHolder.item, rating);
                        break;
                }
            }
        },
        loadCache() {
            let cursor = this.currentlyShownItemHolder.prev.prev.prev; // 3 back because we cache 3 at each side
            for(let i = 0; i < this.imageCache.length; ++i) {
                if(this.imageCache[i] === null) {
                    let img = new Image();
                    img.src = this.createImageUrl(cursor.item);
                    this.imageCache[i] = img;
                }
                cursor = cursor.next;
            }
        },
        createImageUrl(image) {
            return '/main/img/' + image.id + '/download?maxw=' + this.contentMaxWidth + '&maxh=' + this.contentMaxHeight;
        },
        toggleMetadata() {
            if(this.showMetadata) {
                this.showMetadata = false;
            } else {
                this.metadataLoading = true;
                let id = this.currentlyShownItemHolder.item.id;
                fetch(`/main/api/img/${id}/metadata`, { method: 'get', headers: { 'content-type': 'application/json' } })
                        .then(res => parseResponse(res, `Could not load metadata for file with id ${id}`, true))
                        .then(json => {
                            let dict = {};
                            for(const [key, value] of Object.entries(json)) {
                                const groupSplitIdx = key.indexOf(':');
                                if (groupSplitIdx < 0) {
                                    if(!('General' in dict)) {
                                        dict['General'] = {};
                                    }
                                    dict['General'][key] = value;
                                } else {
                                    const group = key.slice(0, groupSplitIdx);
                                    const itemKey = key.slice(groupSplitIdx + 1);
                                    if (!(group in dict)) {
                                        dict[group] = {};
                                    }
                                    dict[group][itemKey] = value;
                                }
                            }
                            let sortedMetadata = [];
                            Object.entries(dict).sort().forEach(function([groupName, group]){
                                let sortedGroup = [];
                                Object.entries(group).sort().forEach(function([key, value]) {
                                    sortedGroup.push({
                                        key: key,
                                        value: value
                                    });
                                });
                                sortedMetadata.push({
                                    header: groupName,
                                    items: sortedGroup
                                });
                            });
                            this.metadata = sortedMetadata;
                            this.metadataLoading = false;
                            this.showMetadata = true;
                        });
            }
        },
        updateRating(item, rating) {
            this.postBackgroundAction('set_rating', {value: rating, ids: [item.id]})
                .then(() => {
                    item.rating = rating;
                    this.refreshRatingsOverview();
                })
            
        },
        refreshRatingsOverview() {
            this.ratingsOverview = [0, 0, 0, 0, 0];
            this.ratedItemsCount = 0;
            for(let item of this.items) {
                let itemRating = item.rating;
                if(itemRating > 0) {
                    ++this.ratedItemsCount;
                    this.ratingsOverview[5 - itemRating]++;
                }
            }
            if(this.ratedItemsCount > 0) {
                // at 1*, we write the number of items
                // at 2* and up, we write the <number> / <recommended number>
                let recommended = this.ratedItemsCount;
                for(let i = this.ratingsOverview.length - 2; i >= 0; --i) {
                    recommended = recommended / 5;
                    this.ratingsOverview[i] = `${this.ratingsOverview[i]} / ${Math.round(recommended)}`;
                }
            }
        },
        postBackgroundAction(action, params) {
            let formData = new FormData();
            formData.append('csrfmiddlewaretoken', Cookies.get('csrftoken'));
            formData.append('action', action);
            if (params) {
                for (const [key, val] of Object.entries(params)) {
                    formData.append(key, val);
                }
            }
            return fetch('/main/api/imgset/actions', { method: 'POST', body: formData })
                .then(res => parseResponse(res, `Could not execute action "${action}"`, false));
        }
    },
    data() {
        return {
            loading: true,
            imageCache: [],
            currentlyShownItemHolder: null,
            contentMaxWidth: Math.floor(0.95 * window.innerWidth),
            contentMaxHeight: Math.floor(0.95 * window.innerHeight),
            showMetadata: false,
            metadata: null,
            metadataLoading: false,
            ratingsOverview: [],
            ratedItemsCount: 0,
        }
    },
    created() {
        document.addEventListener('keydown', this.onKeyDown);
    },
    destroyed() {
        document.removeEventListener('keydown', this.onKeyDown);
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                this.loading = true;
                this.showMetadata = false;

                // build a circular list of the items
                let prev = null;
                let head = null;
                for(let item of this.items) {
                    let current = {
                        prev: prev,
                        item: item,
                        next: null,
                    }
                    if(head === null) {
                        head = current;
                    }
                    if(prev) {
                        prev.next = current;
                    }
                    prev = current;

                    if(item === this.startImage) {
                        this.currentlyShownItemHolder = current;
                    }
                }
                head.prev = prev;
                prev.next = head;

                // build an image cache
                this.imageCache = [null, null, null, null, null, null, null];
                const img = new Image();
                img.src = this.createImageUrl(this.currentlyShownItemHolder.item);
                let ctrl = this;
                img.onload = function() {
                    ctrl.loading = false;
                    ctrl.loadCache();
                }
                this.imageCache[3] = img; // always the middle element

                this.refreshRatingsOverview();
            } else {
                this.imageCache = [];
            }
        }
    }
}