export default {
    template: `
        <modal v-if="showModal" @show="onShow" @ok="updateAuthor" @cancel="closeModal" :okButtonDisabled="!authorChosen" id="edit-author-modal">
            <template v-slot:header>
                <h3>Edit author</h3>
            </template>
            <template v-slot:body>
                <label v-for="author in authors">
                    <input type="radio" :id="'author-'+author.id" name="author" :value="author.id" v-model="selectedAuthorId"/>
                    {{ author.name }}
                </label>
            </template>
        </modal>
    `,
    inject: ['backendService'],
    props: ['showModal', 'modelValue'],
    emits: ['update:showModal', 'update:modelValue'],
    data() {
        return {
            selectedAuthorId: this.modelValue,
            authors: [],
        }
    },
    computed: {
        authorChosen() {
            return this.selectedAuthorId > 0;
        },
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateAuthor() {
            this.$emit('update:modelValue', this.selectedAuthorId);
            this.closeModal();
        },
        fetchAuthors() {
            return fetch('/main/api/author', { method: 'get', headers: { 'content-type': 'application/json' } })
                .then(res => this.backendService.parseResponse(res, `Could not load authors`, false))
                .then(json => {
                    this.authors = json;
                }).catch((err) => {
                    this.closeModal();
                    throw err;
                })
        },
        onShow() {
            this.selectedAuthorId = this.modelValue;
            return this.fetchAuthors();
        },
        onKeyDown(e) {
            if(e.key == 'ArrowDown') {
                if(this.authorChosen) {
                    let currentIdx = this.authors.findIndex(el => el.id === this.selectedAuthorId);
                    let nextIdx = currentIdx < this.authors.length - 1 ? currentIdx + 1 : 0;
                    this.selectedAuthorId = this.authors[nextIdx].id;
                } else {
                    this.selectedAuthorId = this.authors[0].id;
                }
                e.preventDefault();
            }
            if(e.key == 'ArrowUp') {
                if(this.authorChosen) {
                    let currentIdx = this.authors.findIndex(el => el.id === this.selectedAuthorId);
                    let previousIdx = currentIdx > 0 ? currentIdx - 1 : this.authors.length - 1;
                    this.selectedAuthorId = this.authors[previousIdx].id;
                } else {
                    this.selectedAuthorId = this.authors[this.authors.length - 1].id;
                }
                e.preventDefault();
            }
        }
    }
}