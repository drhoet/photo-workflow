import { nextTick } from 'vue';

export default {
    template: `
        <modal v-if="showModal" @show="onShow" @hide="onHide" @cancel="closeModal" :closable="false" :cancellable="false" :closeOnClickOutside="true" :closeOnEscape="!keyHandlerSuspended" :loading="loading" id="image-carousel-modal" class="dark">
            <template v-slot:body>
                <template v-if="!loading">
                    <section id="properties">
                        <section id="image">
                            <header>
                                <span>Image</span>
                            </header>
                            <table>
                                <tr>
                                    <td>{{currentlyShownItemHolder.item.name}}</td>
                                </tr>
                            </table>
                        </section>
                        <section id="tags">
                            <header>
                                <span>Tags</span>
                            </header>
                            <table>
                                <tr v-for="tag in tags">
                                    <td>{{tag.full_name}}</td>
                                </tr>
                            </table>
                        </section>
                        <section id="colors-flags">
                            <header>
                                <span>Colors & flags</span>
                            </header>
                            <table>
                                <tr @click="modals.selectPickLabel = true">
                                    <th>Flag</th><td class="mdi" :class="[pickLabel, pickLabel ? 'mdi-flag' : 'mdi-flag-off-outline']"></td>
                                </tr>
                                <tr @click="modals.selectColorLabel = true">
                                    <th>Color</th><td class="mdi" :class="[colorLabel, colorLabel ? 'mdi-checkbox-blank' : 'mdi-checkbox-blank-off-outline']"></td>
                                </tr>
                            </table>
                        </section>
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
                                <tr v-for="(r, index) in ratingsOverview" :class="{active: currentlyShownItemHolder.item.rating === 5 - index}" @click="updateCurrentItemRating(5 - index)">
                                    <th class="mdi mdi-star">{{5 - index}}</th><td>{{r}}</td>
                                </tr>
                                <tr>
                                    <th class="mdi mdi-star"></th><td>{{ratedItemsCount}}</td>
                                </tr>
                            </table>
                        </section>
                    </section>
                    <section id="image">
                        <video v-if="isCurrentlyShownItemVideo" height="720" controls preload="auto" autoplay :src="imageUrl"/>
                        <img v-else :src="imageUrl" />
                    </section>
                    <section id="secondary-actions">
                        <button @click="toggleMetadata" :class="{active: showMetadata}"><div v-if="metadataLoading" class="spinner small">Loading...</div><i class="mdi mdi-information-outline"></i></button>
                        <div id="index">{{currentlyShownItemHolder.idx + 1}} / {{items.length}}</div>
                    </section>
                    <section v-if="showMetadata" id="metadata">
                        <input id="metadataFilter" v-model="metadataFilter" ref="metadataFilter" placeholder="Filter" autocomplete="off" @keyup.escape.prevent="toggleMetadata()"/>
                        <table v-for="metadataBlock in filteredMetadata">
                            <tr>
                                <th colspan=2>{{metadataBlock.header}}</th>
                            </tr>
                            <tr v-for="item in metadataBlock.items">
                                <td>{{item.key}}</td>
                                <td>{{item.value}}</td>
                            </tr>
                        </table>
                    </section>
                    <select-dialog v-model:showModal="modals.selectPickLabel" :options="settings.pickLabels" :modelValue="pickLabel" @update:modelValue="editPickLabel($event)"/>
                    <select-dialog v-model:showModal="modals.selectColorLabel" :options="settings.colorLabels" :modelValue="colorLabel" @update:modelValue="editColorLabel($event)"/>
                    <tagging-dialog v-model:showModal="modals.tagging" :initialTags="tags" @update:tags="editTags($event)" />
                </template>
            </template>
        </modal>
    `,
    inject: ['settings', 'backendService'],
    props: ['showModal', 'items', 'startImage'],
    emits: ['update:showModal'],
    computed: {
        imageUrl() {
            return this.imageCache[3].src; // always the middle element
        },
        pickLabel() {
            return this.currentlyShownItemHolder.item.pick_label;
        },
        colorLabel() {
            return this.currentlyShownItemHolder.item.color_label;
        },
        tags() {
            return this.currentlyShownItemHolder.item.tags;
        },
        isCurrentlyShownItemVideo() {
            return this.isVideo(this.currentlyShownItemHolder.item);
        },
        keyHandlerSuspended() {
            if(this.showMetadata) {
                return true;
            }
            for(let modal of Object.keys(this.modals)) {
                if(this.modals[modal]) {
                    return true; // if any modal is open, we suspend the key handlers
                }
            }
            return false;
        },
        filteredMetadata() {
            if(this.metadataFilter) {
                let metadataFilter = this.metadataFilter.toLowerCase();
                let filteredMetadata = [];
                for(const group of this.metadata) {
                    let filteredItems = group.items.filter((el) => {
                        return el.key.toLowerCase().includes(metadataFilter) || ('' + el.value).toLowerCase().includes(metadataFilter);
                    });
                    if(filteredItems.length > 0) {
                        filteredMetadata.push({
                            header: group.header,
                            items: filteredItems
                        });
                    }
                }
                return filteredMetadata;
            }
            return this.metadata;
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        onKeyDown(e) {
            if(this.keyHandlerSuspended) {
                return;
            }
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
                case 'Home':
                    this.showMetadata = false;
                    for(let i = 0; i < this.imageCache.length; ++i) {
                        this.imageCache[i] = null;
                    }
                    this.currentlyShownItemHolder = this.headHolder;
                    this.loadCache();
                    break;
                case 'End':
                    this.showMetadata = false;
                    for(let i = 0; i < this.imageCache.length; ++i) {
                        this.imageCache[i] = null;
                    }
                    this.currentlyShownItemHolder = this.tailHolder;
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
                    this.updateCurrentItemRating(rating);
                    break;
                case 'f':
                    this.modals.selectPickLabel = true;
                    break;
                case 'c':
                    if(e.ctrlKey) {
                        this.tagsClipboard = [...this.tags];
                    } else {
                        this.modals.selectColorLabel = true;
                    }
                    break;
                case 't':
                    this.modals.tagging = true;
                    break;
                case 'v':
                    if(e.ctrlKey) {
                        this.editTags(this.tagsClipboard);
                    }
                    break;
            }
            e.preventDefault();
        },
        loadCache() {
            let cursor = this.currentlyShownItemHolder.prev.prev.prev; // 3 back because we cache 3 at each side
            for(let i = 0; i < this.imageCache.length; ++i) {
                if(this.imageCache[i] === null) {
                    let ele;
                    if(this.isVideo(cursor.item)) {
                        ele = document.createElement('video');
                    } else {
                        ele = new Image();
                    }
                    ele.src = this.createImageUrl(cursor.item);
                    this.imageCache[i] = ele;
                }
                cursor = cursor.next;
            }
        },
        createImageUrl(image) {
            return '/main/img/' + image.id + '/download?maxw=' + this.contentMaxWidth + '&maxh=' + this.contentMaxHeight;
        },
        isVideo(item) {
            return item.mime_type.startsWith('video/');
        },
        toggleMetadata() {
            if(this.showMetadata) {
                this.showMetadata = false;
            } else {
                this.metadataLoading = true;
                this.metadataFilter = "";
                let id = this.currentlyShownItemHolder.item.id;
                return fetch(`/main/api/img/${id}/metadata`, { method: 'get', headers: { 'content-type': 'application/json' } })
                        .then(res => this.backendService.parseResponse(res, `Could not load metadata for file with id ${id}`, false))
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
                            nextTick(() => this.$refs.metadataFilter.focus());
                        });
            }
        },
        updateCurrentItemRating(rating) {
            let item = this.currentlyShownItemHolder.item;
            return this.postBackgroundAction('set_rating', {value: rating, ids: [item.id]})
                .then(() => {
                    item.rating = rating;
                    this.refreshRatingsOverview();
                });
            
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
        editColorLabel(value) {
            let item = this.currentlyShownItemHolder.item;
            return this.postBackgroundAction('set_color_label', {value: value, ids: [item.id]})
                .then(() => {
                    item.color_label = value;
                });
        },
        editPickLabel(value) {
            let item = this.currentlyShownItemHolder.item;
            return this.postBackgroundAction('set_pick_label', {value: value, ids: [item.id]})
                .then(() => {
                    item.pick_label = value;
                });
        },
        editTags(value) {
            let item = this.currentlyShownItemHolder.item;
            let tagIds = value.map(t => t.id);
            return this.postBackgroundAction('set_tags', {tagIds: tagIds, ids: [item.id]})
                .then(() => {
                    item.tags = value;
                });
        },
        postBackgroundAction(action, params) {
            return this.backendService.postAction('/main/api/imgset/actions', action, params);
        },
        onShow() {
            this.loading = true;
            this.showMetadata = false;

            // build a circular list of the items
            this.headHolder = null;
            this.tailHolder = null;
            let prev = null;
            let idx = 0;
            for(let item of this.items) {
                let current = {
                    prev: prev,
                    item: item,
                    next: null,
                    idx: idx,
                }
                if(this.headHolder === null) {
                    this.headHolder = current;
                    // fall back for when the this.startImage is not in the list of items to show
                    this.currentlyShownItemHolder = this.headHolder;
                }
                if(prev) {
                    prev.next = current;
                }
                prev = current;

                if(item === this.startImage) {
                    this.currentlyShownItemHolder = current;
                }
                ++idx;
            }
            this.tailHolder = prev;
            this.headHolder.prev = this.tailHolder;
            this.tailHolder.next = this.headHolder;

            // build an image cache
            this.imageCache = [null, null, null, null, null, null, null];
            let ele;
            let ctrl = this;
            if(this.isCurrentlyShownItemVideo) {
                ele = document.createElement('video');
                ele.oncanplay = function() {
                    ctrl.loading = false;
                    ctrl.loadCache();
                }
            } else {
                ele = new Image();
                ele.onload = function() {
                    ctrl.loading = false;
                    ctrl.loadCache();
                }
            }
            ele.src = this.createImageUrl(this.currentlyShownItemHolder.item);
            this.imageCache[3] = ele; // always the middle element

            this.refreshRatingsOverview();
        },
        onHide() {
            this.imageCache = [];
        }
    },
    data() {
        return {
            loading: true,
            imageCache: [],
            currentlyShownItemHolder: null,
            headHolder: null,
            tailHolder: null,
            contentMaxWidth: Math.floor(0.95 * window.innerWidth),
            contentMaxHeight: Math.floor(0.95 * window.innerHeight),
            showMetadata: false,
            metadata: null,
            metadataLoading: false,
            metadataFilter: "",
            ratingsOverview: [],
            ratedItemsCount: 0,
            selectOptions: {},
            selectOptionActive: null,
            tagsClipboard: [],
            videoPlayer: null,
            modals: {
                selectColorLabel: false,
                selectPickLabel: false,
                tagging: false,
            },
        }
    }
}