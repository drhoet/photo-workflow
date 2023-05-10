import { nextTick } from 'vue';

export default {
    template: `
        <modal v-if="showModal" @show="onShow" @cancel="closeModal" :closable="false" :cancellable="true" :closeOnEscape="true" :loading="loading" id="tagging-modal" class="noheader nofooter">
            <template v-slot:body>
                <div id="tag-picker">
                    <div id="selected-tags">
                        <span v-for="tag in tags" class="tag">{{tag.full_name}}<i class="mdi mdi-close" @click="removeTag(tag)"></i></span>
                    </div>
                    <input v-model="searchText" @keydown.tab.prevent="pickTag" @keydown.enter.prevent="done" @keydown.down.prevent="selectNext" @keydown.up.prevent="selectPrevious" id="search" ref="search" autocomplete="off"/>
                    <div class="help">Press <span class="shortcut">tab</span> to select a tag, press <span class="shortcut">enter</span> to apply all tabs to the image. Typing <span class="shortcut">/</span> will make the filter only search in a tag segment.</div>
                    <div id="proposals" ref="proposals">
                        <div v-for="(proposal, index) in proposals" class="tag" :class="{active: index == selectedIndex}" @click="pickSelectedTag(index)">{{proposal.full_name}}</div>
                    </div>
                </div>
                <div id="tag-tree-view">
                    <ul>
                        <tree-view-node v-for="node in tagTree" :node="node" labelKey="tag.name" childrenKey="subtags" @addClicked="addClicked($event)" />
                    </ul>
                </div>
                <create-tag-dialog v-model:showModal="modals.createTag" modelValue="" :parent="newSubTagParent" @update:modelValue="createNewSubTag($event)"/>
            </template>
        </modal>
    `,
    inject: ['taggingService', 'backendService'],
    props: {
        showModal: {
            type: Boolean,
            required: true
        },
        initialTags: {
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
            this.$emit('update:tags', [...this.tags]);
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
        },
        addClicked(node) {
            this.newSubTagParent = node;
            this.modals.createTag = true;
        },
        createNewSubTag(newSubTagValue) {
            this.loading = true;
            return this.backendService.postAction(`/main/api/tag/${this.newSubTagParent.tag.id}/actions`, 'create_subtag', { name: newSubTagValue })
                .then(() => this.taggingService.load(true))
                .then(() => {
                    this.proposals = this.taggingService.find(this.searchText);
                    this.tagTree = this.taggingService.tags;
                    nextTick(() => this.$refs.search.focus());
                })
                .finally(() => this.loading = false);
        },
        onShow() {
            this.searchText = '';
            this.selectedIndex = 0;
            this.tags = [...this.initialTags]; // make a copy here! We don't want to update the array coming from the parent component
            if(!this.taggingService.loaded) {
                this.loading = true;
                this.taggingService.load()
                    .then(() => {
                        this.proposals = this.taggingService.find(this.searchText);
                        this.tagTree = this.taggingService.tags;
                        this.loading = false;
                        nextTick(() => this.$refs.search.focus());
                    });
            } else {
                this.proposals = this.taggingService.find(this.searchText);
                this.tagTree = this.taggingService.tags;
                nextTick(() => this.$refs.search.focus());
            }
        }
    },
    data() {
        return {
            loading: false,
            searchText: '',
            selectedIndex: 0,
            proposals: [],
            tagTree: [],
            tags: [],
            newSubTagParent: null,
            modals: {
                createTag: false,
            },
        }
    },
    watch: {
        searchText(newVal, oldVal) {
            if(this.taggingService.loaded) {
                this.proposals = this.taggingService.find(this.searchText);
            }
        }
    }
}