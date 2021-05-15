import { parseResponse } from "./errorHandler.js";

export default {
    template: `
        <breadcrumbs :items="crumbs"/>
        <div id="contents">
            <section id="actions">
                <button @click="removeFromDb()"><i class="mdi mdi-lock-question"></i><span>Placeholder</span></button>
                <button @click="showEditAuthorDialog=true"><i class="mdi mdi-account"></i><span>Edit author</span></button>
                <button @click="showEditTimezoneDialog=true"><i class="mdi mdi-clock"></i><span>Edit timezone</span></button>
            </section>
            <div v-if="loading" class="spinner">Loading...</div>
            <section v-else id="items">
                <table>
                    <tr>
                        <td colspan="2"><img :src="'/main/img/' + image.id + '/download?w=500'" width="500" /></td>
                    </tr>
                    <tr v-for="(item, key) in metadata">
                        <th>{{key}}</th>
                        <td>{{item}}</td>
                    </tr>
                </table>

                <edit-author-dialog v-model:showModal="showEditAuthorDialog" :modelValue="image.author.id" @update:modelValue="editAuthor($event)"/>
                <edit-timezone-dialog v-model:showModal="showEditTimezoneDialog" :items="[image]" @update:timezone="editTimezone($event)"/>
            </section>
        </div>
    `,
    methods: {
        loadData(id) {
            this.loading = true;
            return Promise.all([
                fetch(`/main/api/img/${id}/metadata`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load metadata for file with id ${id}`, true))
                    .then(json => {
                        this.metadata = json;
                    }),
                fetch(`/main/api/img/${id}/detail`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load image with id ${id}`, true))
                    .then(json => {
                        this.image = json;
                    })
            ]).then(() => {
                return fetch(`/main/api/dir/${this.image.parent.id}/crumbs`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load crumbs for directory with id ${this.image.parent.id}`, true))
                    .then(json => {
                        this.crumbs = json.map((it, idx, all) => {
                            return {
                                id: it.id,
                                name: it.path,
                                last: false,
                                showLink: true
                            }
                        });
                        this.crumbs.push({
                            id: id,
                            name: this.image.name,
                            last: true,
                            showLink: false
                        });
                    })
            }).then(() => {
                this.loading = false;
                document.title = `Workflow - ${this.image.name}`;
            });
        },
        editAuthor(authorId) {
            return this.postImageSetAction('set_author', { ids: [this.image.id], author: authorId })
                .then(() => this.loadData(this.$route.params.id));
        },
        editTimezone(params) {
            return this.postImageSetAction('edit_timezone', params)
                .then(() => this.loadData(this.$route.params.id));
        },
        postImageSetAction(action, params) {
            return this.postAction('/main/api/imgset/actions', action, params);
        },
        postAction(url, action, params) {
            this.loading = true;

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
        }
    },
    data() {
        return {
            loading: true,
            image: null,
            metadata: null,
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