import { parseResponse, UiError } from "./errorHandler.js";
import { DateTime, FixedOffsetZone } from "luxon";

export default {
    // remark: we cannot use v-model:showModal below, because that will expand to something like @update:showModal="showModal = false",
    // attempting to update the prop showModal.
    template: `
        <modal :showModal="showModal" @update:showModal="closeModal" @ok="updateTimezone" id="edit-timezone-modal">
            <template v-slot:header>
                <h3>Edit timezone</h3>
            </template>
            <template v-slot:body>
                <label>
                    <input type="radio" value="overwrite" v-model="mode"/>
                    Overwrite timezone<template v-if="multipleItems"> in all images</template>
                </label>
                <label>
                    <input type="radio" value="translate" v-model="mode" />
                    Translate <template v-if="multipleItems">all timezones</template><template v-else>timezone</template> with a fixed amount
                </label>

                <span v-if="multipleActualTimezones" id="multipleValuesWarning">
                    Files in this directory do not all have the same timezone. These are the timezones that appear:
                    <table>
                        <tr>
                            <th>Timezone</th>
                            <th>Count</th>
                            <th>New timezone</th>
                        </tr>
                        <tr v-for="(cnt, tz) in actualTimezones">
                            <td>{{ formatTimezone(tz) }}</td>
                            <td>{{ cnt }}</td>
                            <td v-if="mode == 'overwrite'">{{ formatTimezone(value) }}</td>
                            <td v-if="mode == 'translate'">{{ formatTimezone(parseInt(tz) + value) }}</td>
                        </tr>
                    </table>
                </span>
                <span>
                    <label v-if="mode == 'overwrite'">New timezone:</label>
                    <label v-if="mode == 'translate'">Adjust timezone by:</label>
                    <span class="selector">
                        <button @click="decreaseValueByHour">--</button>
                        <button @click="decreaseValue">-</button>
                        <span>{{ formatTimezone(value) }}</span>
                        <button @click="increaseValue">+</button>
                        <button @click="increaseValueByHour">++</button>
                    </span>
                </span>
            </template>
        </modal>
    `,
    props: ['showModal', 'items'],
    emits: ['update:showModal', 'update:timezone'],
    data() {
        return {
            value: 0,
            actualTimezones: {},
            mode: 'overwrite',
            modes: ['overwrite', 'translate']
        }
    },
    computed: {
        multipleActualTimezones() {
            return Object.entries(this.actualTimezones).length > 1;
        },
        multipleItems() {
            return this.items.length > 1;
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateTimezone() {
            let ids = this.items
                .filter(item => this.mode === 'overwrite' || (this.mode === 'translate' && this.extractTimezone(item.date_time) !== 'N/A'))
                .map(item => item.id);

            this.$emit('update:timezone', {
                mode: this.mode,
                value: this.value,
                ids: ids,
            });
            this.closeModal();
        },
        increaseValue() {
            this.value += 15;
        },
        increaseValueByHour() {
            this.value += 60;
        },
        decreaseValue() {
            this.value -= 15;
        },
        decreaseValueByHour() {
            this.value -= 60;
        },
        formatTimezone(tz) {
            if(tz === 'N/A') {
                return 'N/A';
            } else {
                return FixedOffsetZone.instance(tz).formatOffset(0, 'short');
            }
        },
        extractTimezone(dt) {
            let key = 'N/A';
            if(dt) {
                const parsed = DateTime.fromISO(dt, {setZone: true});
                if (dt.length > 19) {
                    key = parsed.offset;
                }
            }
            return key;
        },
        extractTimezones() {
            let tzMap = {};
            this.items.forEach(it => {
                let key = this.extractTimezone(it.date_time);
                if (key in tzMap) {
                    tzMap[key] = tzMap[key] + 1;
                } else {
                    tzMap[key] = 1;
                }
            });
            let selectedTz = -1;
            let maxCnt = -1;
            for(const [tz, cnt] of Object.entries(tzMap)) {
                if(cnt > maxCnt) {
                    maxCnt = cnt;
                    selectedTz = tz;
                }
            }

            this.actualTimezones = tzMap;
            this.value = selectedTz == 'N/A' ? 0 : parseInt(selectedTz);
        }
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                return this.extractTimezones();
            }
        }
    }

}