import IndexView from './modules/indexView.js'
import DirectoryLink from './modules/directoryLink.js'
import DirectoryDetailView from './modules/directoryDetailView.js'
import ImageDetailView from './modules/imageDetailView.js'
import ModalDialog from './modules/modalDialog.js'
import SelectAuthorDialog from './modules/selectAuthorDialog.js'
import ErrorHandler from './modules/errorHandler.js'
import EditTimezoneDialog from './modules/editTimezoneDialog.js'

const About = { template: '<div>About</div>' }

const ImageOverview = {
    template: "#image-overview-template",
    props: ['item'],
    computed: {
        formattedDate() {
            if(this.item.date_time) {
                const parsed = luxon.DateTime.fromISO(this.item.date_time, {setZone: true});
                if(this.item.date_time.length > 19) {
                    return parsed.toLocaleString({ dateStyle: 'medium', timeStyle: 'long'});
                } else {
                    return parsed.toLocaleString({ dateStyle: 'medium', timeStyle: 'medium'}) + " (no offset information)";
                }
            } else {
                return "#no_value";
            }
        }
    }
}

const Breadcrumbs = {
    template: "#breadcrumbs-template",
    props: ['items']
}

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [
        { name: 'home', path: '/', component: IndexView },
        { path: '/about', component: About },
        { name: 'directory-detail-view', path: '/dir/:id/detail', component: DirectoryDetailView },
        { name: 'image-detail-view', path: '/img/:id/detail', component: ImageDetailView }
    ],
});

const app = Vue.createApp({});

app.component('directory-link', DirectoryLink);
app.component('image-overview', ImageOverview);
app.component('modal', ModalDialog);
app.component('breadcrumbs', Breadcrumbs);
app.component('select-author-dialog', SelectAuthorDialog);
app.component('error-handler', ErrorHandler);
app.component('edit-timezone-dialog', EditTimezoneDialog);

app.use(router);
app.mount('#app');

