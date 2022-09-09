export default {
    template: `
        <template v-if="showModal">
            <div class="modal-mask">
                <div class="modal-wrapper" @click.self="onClickOutside">
                    <div class="spinner" :class="{hidden: !loading}">Loading...</div>
                    <div class="modal-container" :class="{hidden: loading}">
                        <div class="modal-header">
                            <slot name="header"></slot>
                        </div>
                        <div class="modal-body">
                            <slot name="body"></slot>
                        </div>
                        <div class="modal-footer">
                            <button v-if="closable" class="modal-default-button" @click="ok" :disabled="okButtonDisabled">OK</button>
                            <button v-if="cancellable" class="modal-cancel-button" @click="cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    `,
    props: {
        showModal: Boolean,
        closable: {
            type: Boolean,
            default: true,
        },
        cancellable: {
            type: Boolean,
            default: true,
        },
        okButtonDisabled: Boolean,
        closeOnEscape: {
            type: Boolean,
            default: true,
        },
        closeOnClickOutside: {
            type: Boolean,
            default: false,
        },
        loading: {
            type: Boolean,
            default: false,
        }
    },
    emits: ['ok', 'cancel'],
    methods: {
        ok() {
            this.$emit('ok');
        },
        cancel() {
            this.$emit('cancel');
        },
        onClickOutside() {
            if(this.closeOnClickOutside) {
                this.cancel();
            }
        },
        onKeyDown(e) {
            if(this.showModal && this.closeOnEscape && e.key === 'Escape') {
                this.cancel();
            }
        }
    },
    created() {
        document.addEventListener('keydown', this.onKeyDown);
    },
    destroyed() {
        document.removeEventListener('keydown', this.onKeyDown);
    }
}