export default {
    template: `
        <li :class="open ? 'open': 'closed'">
            <span @click="open = !open" :class="[hasChildren ? 'caret': 'nocaret', open ? 'open': 'closed']">
                <span class="label">{{label}}</span>
                <span class="add mdi mdi-plus-box" @click.stop="add(node)"></span>
            </span>
            <ul v-if="hasChildren">
                <tree-view-node v-for="child in children" :node="child" :labelKey="labelKey" :childrenKey="childrenKey" @addClicked="add($event)"/>
            </ul>
        </li>
    `,
    inject: ['taggingService'],
    props: ['node', 'labelKey', 'childrenKey'],
    emits: ['addClicked'],
    computed: {
        label() {
            return this.getPropFromObject(this.node, this.labelKey);
        },
        children() {
            return this.getPropFromObject(this.node, this.childrenKey);
        },
        hasChildren() {
            return this.children.length > 0;
        }
    },
    methods: {
        getPropFromObject(obj, prop) {
            const idx = prop.indexOf('.');
            if(idx >= 0) {
                return this.getPropFromObject(obj[prop.slice(0, idx)], prop.slice(idx + 1));
            } else {
                return obj[prop];
            }
        },
        add(node) {
            this.$emit('addClicked', node);
        }
    },
    data() {
        return {
            open: false,
        };
    }
}