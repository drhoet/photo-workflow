import IndexView from './modules/indexView.js'
import DirectoryLink from './modules/directoryLink.js'
import DirectoryDetailView from './modules/directoryDetailView.js'
import ImageDetailView from './modules/imageDetailView.js'
import ModalDialog from './modules/modalDialog.js'
import SelectAuthorDialog from './modules/selectAuthorDialog.js'
import ErrorHandler from './modules/errorHandler.js'

const About = { template: '<div>About</div>' }

const ImageOverview = {
    template: "#image-overview-template",
    props: ['item'],
    computed: {
        formattedDate() {
            if(this.item.date_time) {
                return new Date(this.item.date_time).toLocaleString('en-GB', { timeZoneName: 'short' });
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

const routes = [
    { name: 'home', path: '/', component: IndexView },
    { path: '/about', component: About },
    { name: 'directory-detail-view', path: '/dir/:id/detail', component: DirectoryDetailView },
    { name: 'image-detail-view', path: '/img/:id/detail', component: ImageDetailView }
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: routes,
});

const app = Vue.createApp({});

app.component('directory-link', DirectoryLink);
app.component('image-overview', ImageOverview);
app.component('modal', ModalDialog);
app.component('breadcrumbs', Breadcrumbs);
app.component('select-author-dialog', SelectAuthorDialog);
app.component('error-handler', ErrorHandler);

app.use(router);
app.mount('#app');

