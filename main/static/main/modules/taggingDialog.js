import { nextTick } from 'vue';

export default {
    template: `
        <modal :showModal="showModal" @cancel="closeModal" :closable="false" :cancellable="true" :closeOnEscape="true" :loading="loading" id="tagging-modal">
            <template v-slot:body>
                <div id="selected-tags">
                    <span v-for="tag in tags" class="tag">{{tag.full_name}}<i class="mdi mdi-close" @click="removeTag(tag)"></i></span>
                </div>
                <input v-model="searchText" @keydown.tab.prevent="pickTag" @keydown.enter.prevent="done" @keydown.down.prevent="selectNext" @keydown.up.prevent="selectPrevious" id="search" ref="search" autocomplete="off"/>
                <div class="help">Press <span class="shortcut">tab</span> to select a tag, press <span class="shortcut">enter</span> to apply all tabs to the image. Typing <span class="shortcut">/</span> will make the filter only search in a tag segment.</div>
                <div id="proposals" ref="proposals">
                    <div v-for="(proposal, index) in proposals" class="tag" :class="{active: index == selectedIndex}" @click="pickSelectedTag(index)">{{proposal.full_name}}</div>
                </div>
            </template>
        </modal>
    `,
    inject: ['taggingService'],
    props: {
        showModal: {
            type: Boolean,
            required: true
        },
        tags: {
            type: Object,
            required: true
        },
    },
    emits: ['update:showModal', 'update:tags'],
    methods: {
        pickTag() {
            if(this.proposals && this.proposals.length > 0) {
                this.tags.push(this.proposals[this.selectedIndex]);
                this.searchText = '';
                this.selectedIndex = 0;
            }
        },
        pickSelectedTag(index) {
            this.selectedIndex = index;
            this.tags.push(this.proposals[index]);
            this.$refs.search.focus();
        },
        removeTag(tag) {
            let idx = this.tags.indexOf(tag);
            if(idx >= 0) {
                this.tags.splice(idx, 1);
            }
            this.$refs.search.focus();
        },
        done() {
            this.$emit('update:tags', this.tags);
            this.closeModal();
        },
        closeModal() {
            this.$emit('update:showModal', false);
        },
        selectNext() {
            if(this.proposals) {
                ++this.selectedIndex;
                if(this.selectedIndex == this.proposals.length) {
                    this.selectedIndex = 0;
                }
                this.scrollSelectedProposalIntoView();
            }
        },
        selectPrevious() {
            if(this.proposals) {
                if(this.selectedIndex == 0) {
                    this.selectedIndex = this.proposals.length;
                }
                --this.selectedIndex;
                this.scrollSelectedProposalIntoView();
            }
        },
        scrollSelectedProposalIntoView() {
            this.$refs.proposals.children[this.selectedIndex].scrollIntoView({block: 'nearest'});
        }
    },
    data() {
        return {
            loading: false,
            searchText: '',
            selectedIndex: 0,
            proposals: [],
        }
    },
    watch: {
        showModal(newVal, oldVal) {
            if(newVal) {
                this.searchText = '';
                this.selectedIndex = 0;
                if(!this.taggingService.loaded) {
                    this.loading = true;
                    this.taggingService.load()
                        .then(() => {
                            this.proposals = this.taggingService.find(this.searchText);
                            this.loading = false;
                            nextTick(() => this.$refs.search.focus());
                        });
                } else {
                    this.proposals = this.taggingService.find(this.searchText);
                    nextTick(() => this.$refs.search.focus());
                }
            }
        },
        searchText(newVal, oldVal) {
            if(this.taggingService.loaded) {
                this.proposals = this.taggingService.find(this.searchText);
            }
        }
    }
}