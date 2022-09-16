import { Duration } from "luxon";

export default {
    template: `
        <modal :showModal="showModal" @ok="shiftTime" @cancel="closeModal" id="shift-time-modal">
            <template v-slot:header>
                <h3>Edit timezone</h3>
            </template>
            <template v-slot:body>
                <span>
                    <label>Adjust time by:</label>
                    <span class="selector">
                        <button @click="decreaseValueByHour">-1h</button>
                        <button @click="decreaseValue">-1m</button>
                        <span>{{ formattedTime }}</span>
                        <button @click="increaseValue">+1m</button>
                        <button @click="increaseValueByHour">+1h</button>
                    </span>
                </span>
            </template>
        </modal>
    `,
    props: ['showModal'],
    emits: ['update:showModal', 'update:time'],
    data() {
        return {
            minutes: 0
        }
    },
    computed: {
        formattedTime() {
            return Duration.fromObject({minutes: this.minutes}).toFormat("dd'd' hh'h' mm'm'");
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        shiftTime() {
            this.$emit('update:time', this.minutes);
            this.closeModal();
        },
        increaseValue() {
            this.minutes += 1;
        },
        increaseValueByHour() {
            this.minutes += 60;
        },
        decreaseValue() {
            this.minutes -= 1;
        },
        decreaseValueByHour() {
            this.minutes -= 60;
        }
    },
    watch: {
        showModal(newVal, oldVal) {
            if(newVal) {
                this.minutes = 0;
            }
        }
    }

}