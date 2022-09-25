export default {
    template: `
        <li :class="open ? 'open': 'closed'">
            <span @click="open = !open" :class="[hasChildren ? 'caret': 'nocaret', open ? 'open': 'closed']">{{label}}</span>
            <ul v-if="hasChildren">
                <tree-view-node v-for="child in children" :node="child" :labelKey="labelKey" :childrenKey="childrenKey" />
            </ul>
        </li>
    `,
    inject: ['taggingService'],
    props: ['node', 'labelKey', 'childrenKey'],
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
        }
    },
    data() {
        return {
            open: false,
        };
    }
}