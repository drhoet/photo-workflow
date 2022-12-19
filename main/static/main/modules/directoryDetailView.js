import { UiError } from "./errorHandler.js";

export default {
    template: `
        <breadcrumbs :items="crumbs"/>
        <div id="contents">
            <section id="actions">
                <button @click="removeFromDb()"><i class="mdi mdi-delete"></i><span>Remove current directory from database</span></button>
                <button @click="scan(false)"><i class="mdi mdi-find-replace"></i><span>Find new items</span></button>
                <button @click="scan(true)"><i class="mdi mdi-refresh"></i><span>Scan directory (reload)</span></button>
                <button @click="organize()"><i class="mdi mdi-file-tree"></i><span>Organize into directories</span></button>
                <button class="multiple"><i class="mdi mdi-earth"></i>
                    <span>
                        <div @click="modals.geotag=true">Geotag</div>
                        <div @click="modals.pickCoordinates=true">Set coordinates</div>
                        <div @click="modals.pictureMap=true">Show picture map</div>
                    </span>
                </button>
                <button @click="modals.editAuthor=true"><i class="mdi mdi-account"></i><span>Edit author</span></button>
                <button class="multiple"><i class="mdi mdi-clock"></i>
                    <span>
                        <div @click="modals.shiftTime=true">Shift time</div>
                        <div @click="modals.editTimezone=true">Edit timezone</div>
                    </span>
                </button>
                <button class="multiple"><i class="mdi mdi-broom"></i>
                    <span>
                        <div @click="trashFlaggedForRemoval()">Trash flagged for removal</div>
                        <div @click="trashUnstarredRaws()">Trash unstarred raws</div>
                    </span>
                </button>
                <button @click="writeMetadata()"><i class="mdi mdi-content-save"></i><span>Write metadata</span></button>
            </section>
            <div v-if="loading" class="spinner">Loading...</div>
            <template v-else>
                <section id="items">
                    <div v-if="showSubdirs" id="subdirs">
                        <directory-link v-for="subdir in directory.subdirs" :item="subdir"/>
                    </div>
                    <div v-if="showFilters" id="filters">
                        <div id="flag-filters">
                            <button v-for="f of settings.pickLabels" @click="toggleFlagsFilter(f.value)" class="mdi force-color" :class="[{active: filter.flags.includes(f.value)}, 'mdi-' + f.icon, f.value]" :title="f.label"></button>
                        </div>
                        <div id="color-filters">
                            <button v-for="c of settings.colorLabels" @click="toggleColorsFilter(c.value)" class="mdi force-color" :class="[{active: filter.colors.includes(c.value)}, 'mdi-' + c.icon, c.value]" :title="c.label"></button>
                        </div>
                        <div id="rating-filters">
                            <button v-for="index in 6" @click="toggleStarsFilter(index-1)" class="mdi mdi-star" :class="{active: filter.stars.includes(index - 1)}">{{index - 1}}</button>
                        </div>
                    </div>
                    <ul v-if="showImages" id="images">
                        <li v-for="image in filteredImages" class="item" :class="{selected: isImageSelected(image)}" @click="onImageSelected(image, $event)">
                            <image-overview :item="image" @item:open="onImageViewOpen(image)"/>
                        </li>
                    </ul>
                </section>
                <edit-author-dialog v-model:showModal="modals.editAuthor" :modelValue="0" @update:modelValue="editAuthor($event)"/>
                <shift-time-dialog v-model:showModal="modals.shiftTime" @update:time="shiftTime($event)"/>
                <edit-timezone-dialog v-model:showModal="modals.editTimezone" :items="applyToItems" @update:timezone="editTimezone($event)"/>
                <geotag-dialog v-model:showModal="modals.geotag" :directory="directory" @update:trackIds="geotag($event)"/>
                <pick-coordinates-dialog v-model:showModal="modals.pickCoordinates" @update:coordinates="editCoordinates($event)"/>
                <picture-map-dialog v-model:showModal="modals.pictureMap" :items="applyToItems"/>
                <image-carousel-dialog v-model:showModal="modals.imageCarousel" :items="filteredImages" :startImage="lastSelectedItem" class="noheader nofooter"/>
                <tagging-dialog v-model:showModal="modals.tagging" :initialTags="[]" @update:tags="editTags($event)" />
            </template>
        </div>
    `,
    inject: ['backendService', 'settings'],
    computed: {
        applyToItems() {
            return this.selectedItems.length > 0 ? this.selectedItems: this.filteredImages;
        },
        keyHandlerSuspended() {
            for(let modal of Object.keys(this.modals)) {
                if(this.modals[modal]) {
                    return true; // if any modal is open, we suspend the key handlers
                }
            }
            return false;
        },
        showSubdirs() {
            return this.directory.subdirs.length > 0;
        },
        showFilters() {
            return this.showImages;
        },
        showImages() {
            return this.directory.images.length > 0;
        },
        filteredImages() {
            return this.directory.images
                .filter((img) => {
                    return this.filter.stars.includes(img.rating)
                        && this.filter.flags.includes(img.pick_label)
                        && this.filter.colors.includes(img.color_label);
                });
        }
    },
    methods: {
        loadData(id) {
            this.loading = true;
            return Promise.all([
                fetch(`/main/api/dir/${id}/crumbs`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => this.backendService.parseResponse(res, `Could not load crumbs for directory with id ${id}`, true))
                    .then(json => this.crumbs = json.map((it, idx, all) => {
                        return {
                            id: it.id,
                            name: it.path,
                            last: idx == all.length - 1,
                            showLink: it.id !== parseInt(id)
                        }
                    })),
                fetch(`/main/api/dir/${id}/detail`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => this.backendService.parseResponse(res, `Could not load directory with id ${id}`, true) )
                    .then(json => {
                        this.directory = json;
                        // apply selection after reload: the objects are new, ids are probably the same (except on reload)
                        let selectedIds = this.selectedItems.length > 0 ? this.selectedItems.map(el => el.id) : [];
                        let lastSelectedItemId = this.lastSelectedItem ? this.lastSelectedItem.id : null;
                        this.selectedItems.length = 0; // clear, so we don't have old items left if some would have disappeared from the directory
                        this.lastSelectedItem = null; // clear, same reason
                        for(let item of this.directory.images) {
                            if(selectedIds.includes(item.id)) {
                                this.selectedItems.push(item);
                            }
                            if(lastSelectedItemId === item.id) {
                                this.lastSelectedItem = item;
                            }
                        }
                    })
            ]).then(() => {
                this.loading = false;
                document.title = `Workflow - ${this.directory.path}`;
            });
        },
        removeFromDb() {
            const parentId = this.directory.parent.id;
            return this.postDirectoryAction('remove_dir_from_db')
                .then(() => this.$router.push({ name: 'directory-detail-view', params: { id: parentId } }));
        },
        scan(reloadMetadata) {
            return this.postDirectoryAction('scan', { 'reload': reloadMetadata })
                .then(() => this.loadData(this.$route.params.id));
        },
        organize() {
            return this.postDirectoryAction('organize_into_directories')
                .then(() => this.loadData(this.$route.params.id));
        },
        geotag(params) {
            let ids = this.applyToItems
                .filter(img => img.supported_metadata_types.includes('COORDINATES'))
                .map(img => img.id);
            if(ids.length == 0) {
                throw new UiError('No images selected that support geotagging.');
            }
            return this.postImageSetAction('geotag', { ids: ids, trackIds: params.trackIds, overwrite: params.overwrite })
                .then(() => this.loadData(this.$route.params.id));
        },
        editAuthor(authorId) {
            let ids = this.applyToItems
                .filter(img => img.supported_metadata_types.includes('ARTIST'))
                .map(img => img.id);
            if(ids.length == 0) {
                throw new UiError('No images selected that support setting the author.');
            }
            return this.postImageSetAction('set_author', { ids: ids, author: authorId })
                .then(() => this.loadData(this.$route.params.id));
        },
        editTimezone(params) {
            let ids = params.items
                .filter(img => img.supported_metadata_types.includes('DATE_TIME'))
                .map(img => img.id);
            if(ids.length == 0) {
                throw new UiError('No images selected that support changing the Date/Time.');
            }
            return this.postImageSetAction('edit_timezone', {mode: params.mode, value: params.value, ids: ids})
                .then(() => this.loadData(this.$route.params.id));
        },
        shiftTime(minutes) {
            let ids = this.applyToItems
                .filter(img => img.supported_metadata_types.includes('DATE_TIME'))
                .map(img => img.id);
            if(ids.length == 0) {
                throw new UiError('No images selected that support changing the Date/Time.');
            }
            return this.postImageSetAction('shift_time', {minutes: minutes, ids: ids})
                .then(() => this.loadData(this.$route.params.id));
        },
        editCoordinates(params) {
            let ids = this.applyToItems
                .filter(img => img.supported_metadata_types.includes('COORDINATES'))
                .map(img => img.id);
            if(ids.length == 0) {
                throw new UiError('No images selected that support coordinates.');
            }
            return this.postImageSetAction('set_coordinates', { ids: ids, lat: params.lat, lon: params.lon, overwrite: params.overwrite })
                .then(() => this.loadData(this.$route.params.id));
        },
        editTags(value) {
            let itemIds = this.applyToItems
                .filter(img => img.supported_metadata_types.includes('TAGS'))
                .map(img => img.id);
            let tagIds = value.map(t => t.id);
            return this.postImageSetAction('set_tags', {tagIds: tagIds, ids: itemIds})
                .then(() => this.loadData(this.$route.params.id));
        },
        writeMetadata() {
            return this.postDirectoryAction('write_metadata')
                .then(() => this.loadData(this.$route.params.id));
        },
        trashFlaggedForRemoval() {
            return this.postDirectoryAction('trash_flagged_for_removal')
                .then(() => this.loadData(this.$route.params.id));
        },
        trashUnstarredRaws() {
            return this.postDirectoryAction('trash_unstarred_raws')
                .then(() => this.loadData(this.$route.params.id));
        },
        postDirectoryAction(action, params) {
            return this.postAction(`/main/api/dir/${this.directory.id}/actions`, action, params);
        },
        postImageSetAction(action, params) {
            return this.postAction('/main/api/imgset/actions', action, params);
        },
        postAction(url, action, params) {
            this.loading = true;

            return this.backendService.postAction(url, action, params)
                .finally(() => this.loading = false);
        },
        onImageSelected(item, event) {
            if(event.ctrlKey) {
                let idx = this.selectedItems.indexOf(item);
                if(idx >= 0) {
                    this.selectedItems.splice(idx, 1);
                } else {
                    this.selectedItems.push(item);
                }
            } else if(this.lastSelectedItem && event.shiftKey) {
                document.getSelection().removeAllRanges();
                let idxStart = this.directory.images.indexOf(this.lastSelectedItem);
                let idxEnd = this.directory.images.indexOf(item);
                if(idxStart > idxEnd) {
                    let tmp = idxEnd;
                    idxEnd = idxStart;
                    idxStart = tmp;
                }
                for(let i = idxStart; i <= idxEnd; ++i) {
                    let newItem = this.directory.images[i];
                    if(!this.selectedItems.includes(newItem)) { // don't add duplicates!
                        this.selectedItems.push(newItem);
                    }
                }
            } else {
                if(this.selectedItems.length == 1 && this.selectedItems.includes(item)) {
                    this.selectedItems.length = 0;
                } else {
                    this.selectedItems.length = 0;
                    this.selectedItems.push(item);
                }
            }
            this.lastSelectedItem = item;
        },
        onImageViewOpen(image) {
            this.lastSelectedItem = image;
            this.modals.imageCarousel = true;
        },
        isImageSelected(image) {
            return this.selectedItems.includes(image);
        },
        onKeyDown(e) {
            if(this.keyHandlerSuspended) {
                return;
            }
            if(e.key == "Shift" && !e.repeat) { // on shift down (make sure we don't trigger when the key stays down)
                this.onSelectStartHandler = document.onselectstart; // back-up onselectstart
                document.onselectstart = (e) => false; // don't allow it
            }
            if(e.key == "Escape") {
                this.selectedItems.length = 0;
            }
            if(e.key == ' ') {
                this.modals.imageCarousel = true;
                e.preventDefault();
            }
            if(e.key == 'a' && e.ctrlKey) {
                this.selectedItems.length = 0;
                this.selectedItems.push(...this.filteredImages);
                e.preventDefault();
            }
        },
        onKeyUp(e) {
            if(this.keyHandlerSuspended) {
                return;
            }
            if(e.key == "Shift") {
                document.onselectstart = this.onSelectStartHandler; // restore onselectstart
            }
            if(e.key == 't') {
                this.modals.tagging = true;
                e.preventDefault;
            }
        },
        toggleStarsFilter(cnt) {
            const idx = this.filter.stars.indexOf(cnt);
            if(idx >= 0) {
                this.filter.stars.splice(idx, 1);
            } else {
                this.filter.stars.push(cnt);
            }
        },
        toggleFlagsFilter(color) {
            const idx = this.filter.flags.indexOf(color);
            if(idx >= 0) {
                this.filter.flags.splice(idx, 1);
            } else {
                this.filter.flags.push(color);
            }
        },
        toggleColorsFilter(color) {
            const idx = this.filter.colors.indexOf(color);
            if(idx >= 0) {
                this.filter.colors.splice(idx, 1);
            } else {
                this.filter.colors.push(color);
            }
        }
    },
    data() {
        return {
            loading: true,
            directory: null,
            crumbs: null,
            lastSelectedItem: null,
            selectedItems: [],
            onSelectStartHandler: null,
            modals: {
                editAuthor: false,
                shiftTime: false,
                editTimezone: false,
                geotag: false,
                pickCoordinates: false,
                pictureMap: false,
                imageCarousel: false,
                tagging: false,
            },
            filter: {
                stars: [0, 1, 2, 3, 4, 5],
                flags: [null, 'red', 'yellow', 'green'],
                colors: [null, 'red', 'orange', 'yellow', 'green', 'blue', 'magenta', 'gray', 'black', 'white']
            },
        }
    },
    mounted() {
        return this.loadData(this.$route.params.id);
    },
    created() {
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    },
    destroyed() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    },
    async beforeRouteUpdate(to, from) {
        return this.loadData(to.params.id);
    }
}