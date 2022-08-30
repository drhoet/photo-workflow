import { parseResponse } from "./errorHandler.js";

export default {
    template: `
        <breadcrumbs :items="crumbs"/>
        <div id="contents">
            <section id="actions">
                <button @click="removeFromDb()"><i class="mdi mdi-delete"></i><span>Remove current directory from database</span></button>
                <button @click="scan(false)"><i class="mdi mdi-find-replace"></i><span>Find new items</span></button>
                <button @click="scan(true)"><i class="mdi mdi-refresh"></i><span>Scan directory (reload)</span></button>
                <button @click="organize()"><i class="mdi mdi-file-tree"></i><span>Organize into directories</span></button>
                <button @click="geotag()"><i class="mdi mdi-earth"></i><span>Geotag</span></button>
                <button @click="showEditAuthorDialog=true"><i class="mdi mdi-account"></i><span>Edit author</span></button>
                <button @click="showEditTimezoneDialog=true"><i class="mdi mdi-clock"></i><span>Edit timezone</span></button>
                <button @click="writeMetadata()"><i class="mdi mdi-content-save"></i><span>Write metadata</span></button>
            </section>
            <div v-if="loading" class="spinner">Loading...</div>
            <template v-else>
                <section id="items">
                    <div id="subdirs">
                        <directory-link v-for="subdir in directory.subdirs" :item="subdir"/>
                    </div>
                    <ul id="images">
                        <li v-for="image in directory.images" class="item">
                            <image-overview :item="image"/>
                        </li>
                    </ul>
                </section>
                <edit-author-dialog v-model:showModal="showEditAuthorDialog" :modelValue="0" @update:modelValue="editAuthor($event)"/>
                <edit-timezone-dialog v-model:showModal="showEditTimezoneDialog" :items="directory.images" @update:timezone="editTimezone($event)"/>
            </template>
        </div>
    `,
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
                    .then(json => this.directory = json )
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
        geotag() {
            return this.postDirectoryAction('geotag')
                .then(() => this.loadData(this.$route.params.id));
        },
        editAuthor(authorId) {
            let ids = this.directory.images.map(img => img.id);
            return this.postImageSetAction('set_author', { ids: ids, author: authorId })
                .then(() => this.loadData(this.$route.params.id));
        },
        editTimezone(params) {
            return this.postImageSetAction('edit_timezone', params)
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
        }
    },
    data() {
        return {
            loading: true,
            directory: null,
            crumbs: null,
            showEditAuthorDialog: false,
            showEditTimezoneDialog: false,
        }
    },
    mounted() {
        return this.loadData(this.$route.params.id);
    },
    async beforeRouteUpdate(to, from) {
        return this.loadData(to.params.id);
    }
}