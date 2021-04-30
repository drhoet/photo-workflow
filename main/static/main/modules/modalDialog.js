export default {
    template: `
        <template v-if="showModal">
            <div class="modal-mask">
                <div class="modal-wrapper">
                    <div class="modal-container">
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
        okButtonDisabled: Boolean
    },
    emits: ['update:showModal', 'ok', 'cancel'],
    methods: {
        ok() {
            this.$emit('update:showModal', false);
            this.$emit('ok');
        },
        cancel() {
            this.$emit('update:showModal', false);
            this.$emit('cancel');
        }
    }
}