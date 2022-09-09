export default {
    template: `
        <modal :showModal="showModal" @cancel="closeModal" :closable="false" :cancellable="true" :closeOnEscape="true" class="select-dialog">
            <template v-slot:body>
                <div v-for="option in options" class="option" @click="selectOption(option.value)">
                    <i class="mdi" :class="['mdi-' + option.icon, option.value]"></i>
                    <span>{{option.label}}</span>
                </div>
            </template>
        </modal>
    `,
    props: {
        showModal: {
            type: Boolean,
            required: true
        },
        modelValue: {
            type: Object,
            required: false,
        },
        options: {
            type: Object,
            required: true,
        }
    },
    emits: ['update:showModal', 'update:modelValue'],
    methods: {
        selectOption(option) {
            this.$emit('update:modelValue', option);
            this.closeModal();
        },
        closeModal() {
            this.$emit('update:showModal', false);
        },
    }
}