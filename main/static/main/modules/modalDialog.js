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
        okOnEnter: {
            type: Boolean,
            default: true,
        },
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
    emits: ['ok', 'cancel', 'show', 'hide'],
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
            if(this.closeOnEscape && e.key === 'Escape') {
                this.cancel();
            }
            if(this.okOnEnter && e.key === 'Enter') {
                this.ok();
            }
        }
    },
    watch: {
        showModal(newVal, oldVal) {
            if(newVal) {
                this.$emit('show');
                document.addEventListener('keydown', this.onKeyDown);
            } else {
                document.removeEventListener('keydown', this.onKeyDown);
                this.$emit('hide');
            }
        }
    }
}