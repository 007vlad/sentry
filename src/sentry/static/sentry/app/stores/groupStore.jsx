/** @jsx React.DOM */

var jQuery = require("jquery");
var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var GroupActions = require('../actions/groupActions');
var MemberListStore = require("../stores/memberListStore");
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var ERR_SCHEDULE_DELETE = 'Unable to delete events. Please try again.';
var ERR_SCHEDULE_MERGE = 'Unable to merge events. Please try again.';
var ERR_UPDATE = 'Unable to update events. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

var GroupListStore = Reflux.createStore({
  init() {
    this.items = [];
    this.statuses = {};
    this.pendingChanges = new utils.PendingChangeQueue();

    this.listenTo(GroupActions.assignTo, this.onAssignTo);
    this.listenTo(GroupActions.assignToError, this.onAssignToError);
    this.listenTo(GroupActions.assignToSuccess, this.onAssignToSuccess);
    this.listenTo(GroupActions.delete, this.onDelete);
    this.listenTo(GroupActions.deleteError, this.onDeleteError);
    this.listenTo(GroupActions.merge, this.onMerge);
    this.listenTo(GroupActions.mergeError, this.onMergeError);
    this.listenTo(GroupActions.update, this.onUpdate);
    this.listenTo(GroupActions.updateError, this.onUpdateError);
    this.listenTo(GroupActions.updateSuccess, this.onUpdateSuccess);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.items = [];
    this.statuses = {};
    this.pendingChanges.clear();
    items.forEach(item => {
      this.items.push(item);
    });
    this.trigger();
  },

  add(items) {
    if (!items instanceof Array) {
      items = [items];
    }

    var itemsById = {};
    items.forEach((item) => {
      itemsById[item.id] = item;
    });

    for (var i = 0, item; (item = this.items[i]); i++) {
      if (itemsById[item.id]) {
        jQuery.extend(true, this.items[i], itemsById[item.id]);
        delete itemsById[item.id];
      }
    }

    for (var itemId in itemsById) {
      this.items.push(itemsById[itemId]);
    }

    this.trigger();
  },

  remove(itemId) {
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === itemId) {
        this.items.splice(i, i + 1);
        return;
      }
    }

    this.trigger();
  },

  addStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      this.statuses[id] = {};
    }
    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return;
    }
    this.statuses[id][status] = false;
  },

  hasStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return false;
    }
    return this.statuses[id][status] || false;
  },

  getItem(id) {
    var pendingForId = [];
    this.pendingChanges.forEach(change => {
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        var rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = $.extend(true, {}, rItem);

          for (var c = 0; c < pendingForId.length; c++) {
            rItem = $.extend(true, rItem, pendingForId[c].params);
          }
        }
        return rItem;
      }
    }
  },

  getAllItemIds() {
    return this.items.map((item) => item.id);
  },

  getAllItems() {
    // regroup pending changes by their itemID
    var pendingById = {};
    this.pendingChanges.forEach(change => {
      if (typeof pendingById[change.id] === 'undefined') {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    return this.items.map(item => {
      var rItem = item;
      if (typeof pendingById[item.id] !== 'undefined') {
        // copy the object so dirty state doesnt mutate original
        rItem = $.extend(true, {}, rItem);
        pendingById[item.id].forEach(change => {
          rItem = $.extend(true, rItem, change.params);
        });
      }
      return rItem;
    });
  },

  onAssignTo(changeId, itemId, data) {
    this.addStatus(itemId, 'assignTo');
    this.trigger();
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(changeId, itemId, error) {
    this.clearStatus(itemId, 'assignTo');
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  },

  onAssignToSuccess(changeId, itemId, response) {
    var item = this.getItem(itemId);
    if (!item) {
      return;
    }
    item.assignedTo = response.assignedTo;
    this.clearStatus(itemId, 'assignTo');
    this.trigger();
  },

  onDelete(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'delete');
    });
    this.trigger();
  },

  onDeleteError(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'delete');
    });
    AlertActions.addAlert(ERR_SCHEDULE_DELETE, 'error');
    this.trigger();
  },

  onDeleteSuccess(changeId, itemIds, response) {
    var itemIdSet = new Set(itemIds);
    itemIds.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items.filter((item) => !itemIdSet.has(item.id));
    AlertActions.addAlert(OK_SCHEDULE_DELETE, 'success');
    this.trigger();
  },

  onMerge(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'merge');
    });
  },

  onMergeError(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    AlertActions.addAlert(ERR_SCHEDULE_MERGE, 'error');
    this.trigger();
  },

  onMergeSuccess(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
    this.trigger();
  },

  onUpdate(changeId, itemIds, data) {
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'update');
      this.pendingChanges.push(changeId, itemId, data);
    });
    this.trigger();
  },

  onUpdateError(changeId, itemIds, error, failSilently) {
    this.pendingChanges.remove(changeId);
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'update');
    });
    if (failSilently) {
      AlertActions.addAlert(ERR_UPDATE, 'error');
    }
    this.trigger();
  },

  onUpdateSuccess(changeId, itemIds, response) {
    if (typeof itemIds === 'undefined') {
      itemIds = this.items.map(item => item.id);
    }
    this.items.forEach(item => {
      if (itemIds.indexOf(item.id) !== -1) {
        $.extend(true, item, response);
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.remove(changeId);
    this.trigger();
  }
});

module.exports = GroupListStore;
