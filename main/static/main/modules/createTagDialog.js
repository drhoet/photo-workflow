import { nextTick } from 'vue';

export default {
    template: `
        <modal :showModal="showModal" @ok="createSubTag" @cancel="closeModal" :okButtonDisabled="value === modelValue" id="create-tag-modal">
            <template v-slot:header>
                <h3>Create new tag</h3>
            </template>
            <template v-slot:body>
                <div>Parent: {{ parent.tag.full_name }}</div>
                <input type="text" v-model="value" @keyup.enter.stop="createSubTag" ref="name"/>
            </template>
        </modal>
    `,
    props: ['showModal', 'parent', 'modelValue'],
    emits: ['update:showModal', 'update:modelValue'],
    data() {
        return {
            value: this.modelValue,
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        createSubTag() {
            this.$emit('update:modelValue', this.value);
            this.closeModal();
        }
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                this.value = this.modelValue;
                nextTick(() => this.$refs.name.focus());
            }
        }
    }
}