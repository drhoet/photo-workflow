import { parseResponse } from "./errorHandler.js";

export default {
    template: `
        <div v-if="loading" class="spinner">Loading...</div>
        <div v-else>
            <h2>Registered Catalogs</h2>
            <div id="contents">
                <ul id="roots">
                    <li v-for="root in roots" class="item">
                        <router-link :to="{ name: 'directory-detail-view', params: { id: root.id }}">{{ root.path }}</router-link>
                    </li>
                </ul>
            </div>
        </div>
    `,
    methods: {
        loadData() {
            this.loading = true;
            return fetch(`/main/api/roots`, { method: 'get', headers: { 'content-type': 'application/json' } })
                    .then(res => parseResponse(res, `Could not load directory roots`, true))
                    .then(json => this.roots = json)
                    .then(() => {
                        this.loading = false;
                        document.title = `Workflow - Catalogs`;
                    });
        },
    },
    data() {
        return {
            loading: true,
            roots: null,
        }
    },
    mounted() {
        return this.loadData();
    }
}