export default {
    template: `
        <modal :showModal="showModal" @cancel="closeModal" :closable="false" :cancellable="true" :closeOnEscape="true" class="select-dialog">
            <template v-slot:body>
                <div v-for="option in options" class="option" @click="selectOption(option.value)">
                    <i class="mdi" :class="['mdi-' + option.icon, option.value]"></i>
                    <span class="label">{{option.label}}</span>
                    <span v-if="option.key" class="shortcut">{{shortcutToDisplay(option.key)}}</span>
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
            type: [Object, String, Number, Boolean],
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
        onKeyUp(e) {
            for(const opt of this.options) {
                if(e.key === opt.key) {
                    this.selectOption(opt.value);
                }
            }
        },
        shortcutToDisplay(key) {
            switch(key) {
                case ' ': return 'space';
                default: return key;
            }
        }
    },
    watch: {
        showModal(newVal, oldVal) {
            if(newVal) {
                document.addEventListener('keyup', this.onKeyUp);        
            } else {
                document.removeEventListener('keyup', this.onKeyUp);
            }
        }
    }
}