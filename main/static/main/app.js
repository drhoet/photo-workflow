import { createApp, inject } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import IndexView from './modules/indexView.js'
import DirectoryLink from './modules/directoryLink.js'
import DirectoryDetailView from './modules/directoryDetailView.js'
import ModalDialog from './modules/modalDialog.js'
import EditAuthorDialog from './modules/editAuthorDialog.js'
import ErrorHandler from './modules/errorHandler.js'
import EditTimezoneDialog from './modules/editTimezoneDialog.js'
import GeotagDialog from './modules/geotagDialog.js'
import ImageOverview from './modules/imageOverview.js'
import PickCoordinatesDialog from './modules/pickCoordinatesDialog.js'
import PictureMapDialog from './modules/pictureMapDialog.js'
import ImageCarouselDialog from './modules/imageCarouselDialog.js';
import SelectDialog from './modules/selectDialog.js';
import TaggingDialog from './modules/taggingDialog.js';

import TaggingService from './services/taggingService.js';

const About = { template: '<div>About</div>' }

const Breadcrumbs = {
    template: "#breadcrumbs-template",
    props: ['items']
}

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { name: 'home', path: '/', component: IndexView },
        { path: '/about', component: About },
        { name: 'directory-detail-view', path: '/dir/:id/detail', component: DirectoryDetailView }
    ],
});

class Settings {
    constructor() {
        this.dateTimeLocale = 'en-BE';
        this.numberLocale = 'en-BE';

        this.pickLabels = [
            { value: null, label: 'N/A', key: ' ', icon: 'flag-off-outline' },
            { value: 'red', label: '<unused>', key: 'r', icon: 'flag' },
            { value: 'yellow', label: '<unused>', key: 'y', icon: 'flag' },
            { value: 'green', label: 'Selection', key: 'g', icon: 'flag' }
        ];
        this.colorLabels = [
            { value: null, label: 'N/A', key: ' ', icon: 'checkbox-blank-off-outline' },
            { value: 'red', label: 'Needs editing', key: 'r', icon: 'checkbox-blank' },
            { value: 'orange', label: '<unused>', key: 'o', icon: 'checkbox-blank' },
            { value: 'yellow', label: '<unused>', key: 'y', icon: 'checkbox-blank' },
            { value: 'green', label: '<unused>', key: 'g', icon: 'checkbox-blank' },
            { value: 'blue', label: '<unused>', key: 'b', icon: 'checkbox-blank' },
            { value: 'magenta', label: '<unused>', key: 'm', icon: 'checkbox-blank' },
            { value: 'gray', label: '<unused>', key: 'e', icon: 'checkbox-blank' },
            { value: 'black', label: '<unused>', key: 'b', icon: 'checkbox-blank' },
            { value: 'white', label: '<unused>', key: 'w', icon: 'checkbox-blank' },
        ];
    }
}

const app = createApp({});

app.component('directory-link', DirectoryLink);
app.component('image-overview', ImageOverview);
app.component('modal', ModalDialog);
app.component('breadcrumbs', Breadcrumbs);
app.component('edit-author-dialog', EditAuthorDialog);
app.component('error-handler', ErrorHandler);
app.component('edit-timezone-dialog', EditTimezoneDialog);
app.component('geotag-dialog', GeotagDialog);
app.component('pick-coordinates-dialog', PickCoordinatesDialog);
app.component('picture-map-dialog', PictureMapDialog);
app.component('image-carousel-dialog', ImageCarouselDialog);
app.component('select-dialog', SelectDialog);
app.component('tagging-dialog', TaggingDialog);

app.config.globalProperties.$filters = {
    formatPercentage(value, precision) {
        let settings = inject('settings');
        return new Intl.NumberFormat(settings.numberLocale, { style: 'percent', maximumFractionDigits: precision }).format(value);
    }
};

app.use(router);
app.mount('#app');
app.provide('settings', new Settings());
app.provide('taggingService', new TaggingService());