import { Duration } from "luxon";

export default {
    template: `
        <modal :showModal="showModal" @ok="shiftTime" @cancel="closeModal" id="shift-time-modal">
            <template v-slot:header>
                <h3>Edit time</h3>
            </template>
            <template v-slot:body>
                <span>
                    <label>Adjust time by:</label>
                    <span class="selector">
                        <button @click="decreaseValueByDay">-1d</button>
                        <button @click="decreaseValueByHour">-1h</button>
                        <button @click="decreaseValueByMinute">-1m</button>
                        <span>{{ formattedTime }}</span>
                        <button @click="increaseValueByMinute">+1m</button>
                        <button @click="increaseValueByHour">+1h</button>
                        <button @click="increaseValueByDay">+1d</button>
                    </span>
                    <button @click="increaseValueBy">...</button>
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
        increaseValueByMinute() {
            this.minutes += 1;
        },
        increaseValueByHour() {
            this.minutes += 60;
        },
        increaseValueByDay() {
            this.minutes += 60 * 24;
        },
        decreaseValueByMinute() {
            this.minutes -= 1;
        },
        decreaseValueByHour() {
            this.minutes -= 60;
        },
        decreaseValueByDay() {
            this.minutes -= 60 * 24;
        },
        increaseValueBy() {
            let inc = prompt("Type the number of minutes to increase the value by. Might be negative.", 0);
            if(inc) {
                this.minutes += parseInt(inc);
            }
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