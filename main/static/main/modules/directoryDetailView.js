import { parseResponse, UiError } from "./errorHandler.js";
import Cookies from 'js-cookie';

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
                <button @click="modals.editTimezone=true"><i class="mdi mdi-clock"></i><span>Edit timezone</span></button>
                <button @click="writeMetadata()"><i class="mdi mdi-content-save"></i><span>Write metadata</span></button>
            </section>
            <div v-if="loading" class="spinner">Loading...</div>
            <template v-else>
                <section id="items">
                    <div id="subdirs">
                        <directory-link v-for="subdir in directory.subdirs" :item="subdir"/>
                    </div>
                    <ul id="images">
                        <li v-for="image in directory.images" class="item" :class="{selected: isImageSelected(image)}" @click="onImageSelected(image, $event)">
                            <image-overview :item="image" @item:open="onImageViewOpen(image)"/>
                        </li>
                    </ul>
                </section>
                <edit-author-dialog v-model:showModal="modals.editAuthor" :modelValue="0" @update:modelValue="editAuthor($event)"/>
                <edit-timezone-dialog v-model:showModal="modals.editTimezone" :items="applyToItems" @update:timezone="editTimezone($event)"/>
                <geotag-dialog v-model:showModal="modals.geotag" :directory="directory" @update:trackIds="geotag($event)"/>
                <pick-coordinates-dialog v-model:showModal="modals.pickCoordinates" @update:coordinates="editCoordinates($event)"/>
                <picture-map-dialog v-model:showModal="modals.pictureMap" :items="applyToItems"/>
                <image-carousel-dialog v-model:showModal="modals.imageCarousel" :items="directory.images" :startImage="lastSelectedItem"/>
            </template>
        </div>
    `,
    computed: {
        applyToItems() {
            return this.selectedItems.length > 0 ? this.selectedItems: this.directory.images;
        },
        keyHandlerSuspended() {
            for(let modal of Object.keys(this.modals)) {
                if(this.modals[modal]) {
                    return true; // if any modal is open, we suspend the key handlers
                }
            }
            return false;
        }
    },
    methods: {
        loadData(id) {
            this.loading = true;
            return Promise.all([
                fetch(`/main/api/dir/${id}/crumbs`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load crumbs for directory with id ${id}`, true))
                    .then(json => this.crumbs = json.map((it, idx, all) => {
                        return {
                            id: it.id,
                            name: it.path,
                            last: idx == all.length - 1,
                            showLink: it.id !== parseInt(id)
                        }
                    })),
                fetch(`/main/api/dir/${id}/detail`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load directory with id ${id}`, true) )
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
                throw new UiError('No images selected that support coordinates.');
            }
            return this.postImageSetAction('edit_timezone', {mode: params.mode, value: params.value, ids: ids})
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
        writeMetadata() {
            return this.postDirectoryAction('write_metadata')
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

            let formData = new FormData();
            formData.append('csrfmiddlewaretoken', Cookies.get('csrftoken'));
            formData.append('action', action);
            if (params) {
                for (const [key, val] of Object.entries(params)) {
                    formData.append(key, val);
                }
            }
            return fetch(url, { method: 'POST', body: formData })
                .then(res => parseResponse(res, `Could not execute action "${action}"`, false))
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
        },
        onKeyUp(e) {
            if(this.keyHandlerSuspended) {
                return;
            }
            if(e.key == "Shift") {
                document.onselectstart = this.onSelectStartHandler; // restore onselectstart
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
            activeModal: null,
            modals: {
                editAuthor: false,
                editTimezone: false,
                geotag: false,
                pickCoordinates: false,
                pictureMap: false,
                imageCarousel: false
            }
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