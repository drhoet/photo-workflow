export default {
    // remark: we cannot use v-model:showModal below, because that will expand to something like @update:showModal="showModal = false",
    // attempting to update the prop showModal.
    template: `
        <modal :showModal="showModal" @update:showModal="closeModal" :closable="false" :cancellable="false" :closeOnClickOutside="true" id="image-carousel-modal">
            <template v-slot:body>
                <div v-if="loading" class="spinner">Loading...</div>
                <section v-else id="image">
                    <img :src="imageUrl" />
                </section>
            </template>
        </modal>
    `,
    props: ['showModal', 'items', 'startImage'],
    emits: ['update:showModal'],
    computed: {
        imageUrl() {
            return this.imageCache[3].src; // always the middle element
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        onKeyDown(e) {
            if(this.showModal) {
                switch(e.key) {
                    case 'ArrowLeft':
                        for(let i = this.imageCache.length - 1; i > 0; --i) {
                            this.imageCache[i] = this.imageCache[i - 1];
                        }
                        this.imageCache[0] = null;
                        this.currentlyShownItemHolder = this.currentlyShownItemHolder.prev;
                        this.loadCache();
                        break;
                    case 'ArrowRight':
                        for(let i = 1; i < this.imageCache.length; ++i) {
                            this.imageCache[i - 1] = this.imageCache[i];
                        }
                        this.imageCache[this.imageCache.length - 1] = null;
                        this.currentlyShownItemHolder = this.currentlyShownItemHolder.next;
                        this.loadCache();
                        break;
                }
            }
        },
        loadCache() {
            let cursor = this.currentlyShownItemHolder.prev.prev.prev; // 3 back because we cache 3 at each side
            for(let i = 0; i < this.imageCache.length; ++i) {
                if(this.imageCache[i] === null) {
                    let img = new Image();
                    img.src = this.createImageUrl(cursor.item);
                    this.imageCache[i] = img;
                }
                cursor = cursor.next;
            }
        },
        createImageUrl(image) {
            return '/main/img/' + image.id + '/download?maxw=' + this.contentMaxWidth + '&maxh=' + this.contentMaxHeight;
        }
    },
    data() {
        return {
            loading: true,
            imageCache: [],
            currentlyShownItemHolder: null,
            contentMaxWidth: Math.floor(0.95 * window.innerWidth),
            contentMaxHeight: Math.floor(0.95 * window.innerHeight),
        }
    },
    created() {
        document.addEventListener('keydown', this.onKeyDown);
    },
    destroyed() {
        document.removeEventListener('keydown', this.onKeyDown);
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                this.loading = true;

                // build a circular list of the items
                let prev = null;
                let head = null;
                for(let item of this.items) {
                    let current = {
                        prev: prev,
                        item: item,
                        next: null,
                    }
                    if(head === null) {
                        head = current;
                    }
                    if(prev) {
                        prev.next = current;
                    }
                    prev = current;

                    if(item === this.startImage) {
                        this.currentlyShownItemHolder = current;
                    }
                }
                head.prev = prev;
                prev.next = head;

                // build an image cache
                this.imageCache = [null, null, null, null, null, null, null];
                const img = new Image();
                img.src = this.createImageUrl(this.currentlyShownItemHolder.item);
                let ctrl = this;
                img.onload = function() {
                    ctrl.loading = false;
                    ctrl.loadCache();
                }
                this.imageCache[3] = img; // always the middle element
            } else {
                this.imageCache = [];
            }
        }
    }
}