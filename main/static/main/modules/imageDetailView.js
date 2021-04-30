import { parseResponse } from "./errorHandler.js";

export default {
    template: `
        <breadcrumbs :items="crumbs"/>
        <div id="contents">
            <section id="actions">
                <button @click="removeFromDb()"><i class="mdi mdi-lock-question"></i><span>Placeholder</span></button>
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
            </section>
        </div>
    `,
    methods: {
        loadData(id) {
            this.loading = true;
            this.responseHandler.errorState.clear();
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
        }
    },
    data() {
        return {
            loading: true,
            image: null,
            metadata: null,
            crumbs: null,
        }
    },
    mounted() {
        return this.loadData(this.$route.params.id);
    },
    async beforeRouteUpdate(to, from) {
        return this.loadData(to.params.id);
    }
}