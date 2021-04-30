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
                <button @click="showSelectAuthorDialog=true"><i class="mdi mdi-account"></i><span>Set author</span></button>
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
                <select-author-dialog v-model:showModal="showSelectAuthorDialog" :modelValue="0" @update:modelValue="setAuthor($event)"/>
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
        setAuthor(authorId) {
            return this.postDirectoryAction('set_author', { 'author': authorId })
                .then(() => this.loadData(this.$route.params.id));
        },
        writeMetadata() {
            return this.postDirectoryAction('write_metadata')
                .then(() => this.loadData(this.$route.params.id));
        },
        postDirectoryAction(action, params) {
            this.loading = true;

            let url = `/main/api/dir/${this.directory.id}/actions`;
            let formData = new FormData();
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
    },
    data() {
        return {
            loading: true,
            directory: null,
            crumbs: null,
            showSelectAuthorDialog: false,
        }
    },
    mounted() {
        return this.loadData(this.$route.params.id);
    },
    async beforeRouteUpdate(to, from) {
        return this.loadData(to.params.id);
    }
}