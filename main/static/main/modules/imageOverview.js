import { inject } from 'vue';
import { DateTime } from 'luxon';

export default {
    template: `
        <a href="#" @click.prevent.capture.stop="onThumbnailClicked">
            <div class="thumbnail-container">
                <img class="thumbnail" :src="item.thumbnail"/>
            </div>
            <div class="item-id">
                <i v-if="hasAttachments" class="mdi mdi-paperclip tooltip-symbol">
                    <ul v-if="hasAttachments" class="tooltip-contents">
                        <li v-for="att in item.attachments">{{att.name}}</li>
                    </ul>
                </i>
                <i class="mdi mdi-star"></i>{{item.rating}}
                <span>{{item.name}}</span>
                <i v-if="item.pick_label" class="mdi mdi-flag" :class="item.pick_label"></i>
                <i v-if="item.color_label" class="mdi mdi-checkbox-blank" :class="item.color_label"></i>
                <i v-if="item.camera" class="mdi mdi-camera tooltip-symbol">
                    <div class="tooltip-contents tooltip-align-right">{{item.camera.make}} {{item.camera.model}} {{item.camera.serial}}</div>
                </i>
                <i v-if="item.coordinates" class="mdi mdi-earth"></i>
            </div>
        </a>
        <ul v-if="item.errors" class="errors">
            <li v-for="err in item.errors" class="mdi mdi-alert">{{err}}</li>
        </ul>
        <ul class="properties">
            <li v-if="item.author" class="mdi mdi-account">{{item.author.name}}</li>
            <li class="mdi mdi-clock-outline">{{formattedDate}}</li>
        </ul>
        <ul class="tags">
            <li class="mdi mdi-bookmark" v-if="itemCategories">{{itemCategories}}</li>
            <li class="mdi mdi-earth" v-if="itemLocations">{{itemLocations}}</li>
            <li class="mdi mdi-tag-multiple" v-if="itemOtherTags">{{itemOtherTags}}</li>
        </ul>
    `,
    props: ['item'],
    emits: ['item:open'],
    setup() {
        let settings = inject('settings');
        return {
            settings: settings
        };
    },
    computed: {
        formattedDate() {
            if(this.item.date_time) {
                const parsed = DateTime.fromISO(this.item.date_time, {setZone: true});
                if(this.item.date_time.length > 19) {
                    return parsed.setLocale(this.settings.dateTimeLocale).toLocaleString({ dateStyle: 'medium', timeStyle: 'long'});
                } else {
                    // luxon will assume the local time zone here, we don't want to print that, so we use the 'medium' timeStyle
                    return parsed.setLocale(this.settings.dateTimeLocale).toLocaleString({ dateStyle: 'medium', timeStyle: 'medium'});
                }
            } else {
                return "--";
            }
        },
        hasAttachments() {
            return this.item.attachments.length > 0;
        },
        itemCategories() {
            return this.item.tags.filter(el => el.full_name.startsWith('Categories/')).map(el => el.name).join(", ");
        },
        itemLocations() {
            return this.item.tags.filter(el => el.full_name.startsWith('Places/')).map(el => el.name).join(", ");
        },
        itemOtherTags() {
            return this.item.tags.filter(el => !el.full_name.startsWith('Categories/') && !el.full_name.startsWith('Places/')).map(el => el.name).join(", ");
        }
    },
    methods: {
        onThumbnailClicked() {
            this.$emit('item:open');
        }
    }
}