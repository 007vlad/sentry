/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var utils = require("../../utils");

var api = require("../../api");
var AggregateListStore = require("../../stores/aggregateListStore");
var DateTimeField = require("../../modules/datepicker/DateTimeField");
var DropdownLink = require("../../components/dropdownLink");
var MenuItem = require("../../components/menuItem");
var Modal = require("react-bootstrap/Modal");
var OverlayMixin = require("react-bootstrap/OverlayMixin");
var SelectedAggregateStore = require("../../stores/selectedAggregateStore");

var ActionLink = React.createClass({
  mixins: [OverlayMixin],

  propTypes: {
    actionLabel: React.PropTypes.string,
    aggList: React.PropTypes.instanceOf(Array).isRequired,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    disabled: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
    onAction: React.PropTypes.func.isRequired,
    onlyIfBulk: React.PropTypes.bool,
    selectAllActive: React.PropTypes.bool.isRequired
  },

  getDefaultProps() {
    return {
      confirmLabel: 'Edit',
      onlyIfBulk: false,
      neverConfirm: false,
      disabled: false
    };
  },

  getInitialState() {
    return {
      isModalOpen: false
    };
  },

  handleToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll(event) {
    this.props.onAction(StreamActions.ALL, event);
    this.setState({
      isModalOpen: false
    });
  },

  handleActionSelected(event) {
    this.props.onAction(StreamActions.SELECTED, event);
    this.setState({
      isModalOpen: false
    });
  },

  defaultActionLabel(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  render() {
    var className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <a className={className} disabled={this.props.disabled} onClick={this.handleToggle}>
        {this.props.children}
      </a>
    );
  },

  renderOverlay() {
    if (!this.state.isModalOpen) {
      return <span/>;
    }

    var selectedItemIds = SelectedAggregateStore.getSelectedIds();
    if (selectedItemIds.size === 0) {
      throw new Error('ActionModal rendered without any selected aggregates');
    }

    var shouldConfirm = true;
    // if skipConfirm is set we never actually show the modal
    if (this.props.neverConfirm === true) {
      shouldConfirm = false;
    // if onlyIfBulk is set and we've selected a single item, we skip
    // showing the modal
    } else if (this.props.onlyIfBulk === true && !this.props.selectAllActive) {
      shouldConfirm = false;
    }

    if (!shouldConfirm) {
      this.handleActionSelected();
      this.state.isModalOpen = false;
      return <span />;
    }

    var confirmLabel = this.props.confirmLabel;
    var actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    var numEvents = selectedItemIds.size;

    actionLabel = actionLabel.replace('{count}', numEvents);

    return (
      <Modal title="Please confirm" animation={false} onRequestHide={this.handleToggle}>
        <div className="modal-body">
          <p><strong>Are you sure that you want to {actionLabel}?</strong></p>
          <p>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default"
                  onClick={this.handleToggle}>Cancel</button>
          {this.props.canActionAll &&
            <button type="button" className="btn btn-danger"
                    onClick={this.handleActionAll}>{confirmLabel} all recorded events</button>
          }
          <button type="button" className="btn btn-primary"
                  onClick={this.handleActionSelected}>{confirmLabel} {numEvents} selected events</button>
        </div>
      </Modal>
    );
  }
});

var SortOptions = React.createClass({
  mixins: [Router.State],

  getMenuItem(key, label, isActive) {
    var queryParams = this.getQuery();
    queryParams.sort = key;

    return (
      <MenuItem to="stream" params={this.getParams()} query={queryParams} isActive={isActive}>
        {label}
      </MenuItem>
    );
  },

  render() {
    var queryParams = this.getQuery();
    var sortBy = queryParams.sort || 'date';
    var sortLabel;

    switch (sortBy) {
      case 'new':
        sortLabel = 'First Seen';
        break;
      case 'priority':
        sortLabel = 'Priority';
        break;
      case 'freq':
        sortLabel = 'Frequency';
        break;
      default:
        sortLabel = 'Last Seen';
        sortBy = 'date';
    }

    var dropdownTitle = (
      <span>
        <span className="hidden-sm hidden-xs">Sort by:</span> {sortLabel}
      </span>
    );

    return (
      <DropdownLink
          key="sort"
          className="btn-sm"
          title={dropdownTitle}>
        {this.getMenuItem('priority', 'Priority', sortBy === 'priority')}
        {this.getMenuItem('date', 'Last Seen', sortBy === 'date')}
        {this.getMenuItem('new', 'First Seen', sortBy === 'new')}
        {this.getMenuItem('freq', 'Occurances', sortBy === 'freq')}
      </DropdownLink>
    );
  }
});

var StreamActions = React.createClass({
  mixins: [
    Reflux.listenTo(SelectedAggregateStore, 'onSelectedAggregateChange')
  ],

  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    aggList: React.PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: React.PropTypes.func.isRequired,
    onSelectStatsPeriod: React.PropTypes.func.isRequired,
    realtimeActive: React.PropTypes.bool.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      datePickerActive: false,
      selectAllActive: false,
      anySelected: false,
      multiSelected: false,
    };
  },
  selectStatsPeriod(period) {
    return this.props.onSelectStatsPeriod(period);
  },
  toggleDatePicker() {
    this.setState({
      datePickerActive: !this.state.datePickerActive
    });
  },
  actionSelectedAggregates(callback, data) {
    var itemIds;
    var selectedAggList;

    if (StreamActions.ALL) {
      selectedAggList = this.props.aggList;
    } else {
      itemIdSet = SelectedAggregateStore.getSelectedIds();
      selectedAggList = this.props.aggList.filter(
        (item) => itemIdSet.has(item.id)
      );
      itemIds = selectedAggList.map(
        (item) => item.id
      );
    }

    callback(itemIds);

    SelectedAggregateStore.clearAll();
  },
  onResolve(aggList, event) {
    this.actionSelectedAggregates((itemIds) => {
      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          status: 'resolved'
        }
      });
    });
  },
  onBookmark(aggList, event) {
    this.actionSelectedAggregates((itemIds) => {
      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          isBookmarked: true
        }
      });
    });
  },
  onRemoveBookmark(aggList, event) {
    this.actionSelectedAggregates((itemIds) => {
      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          isBookmarked: false
        }
      });
    });
  },
  onDelete(aggList, event) {
    this.actionSelectedAggregates((itemIds) => {
      api.bulkDelete({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds
      });
    });
  },
  onMerge(aggList, event) {
    this.actionSelectedAggregates((itemIds) => {
      api.merge({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
      });
    });
  },
  onSelectedAggregateChange() {
    this.setState({
      selectAllActive: SelectedAggregateStore.allSelected,
      multiSelected: SelectedAggregateStore.multiSelected,
      anySelected: SelectedAggregateStore.anySelected
    });
  },
  onSelectAll() {
    SelectedAggregateStore.toggleSelectAll();
  },
  render() {
    return (
      <div className="stream-actions row">
        <div className="stream-actions-left col-md-7">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"
                   onChange={this.onSelectAll}
                   checked={this.state.selectAllActive} />
          </div>
          <div className="btn-group">
            <ActionLink
               className="btn btn-default btn-sm action-resolve"
               disabled={!this.state.anySelected}
               onAction={this.onResolve}
               confirmLabel="Resolve"
               canActionAll={true}
               onlyIfBulk={true}
               selectAllActive={this.state.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-checkmark"></i>
            </ActionLink>
            <ActionLink
               className="btn btn-default btn-sm action-bookmark"
               disabled={!this.state.anySelected}
               onAction={this.onBookmark}
               neverConfirm={true}
               confirmLabel="Bookmark"
               canActionAll={false}
               onlyIfBulk={true}
               selectAllActive={this.state.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-bookmark"></i>
            </ActionLink>

            <DropdownLink
              key="actions"
              caret={false}
              disabled={!this.state.anySelected}
              className="btn-sm btn-default hidden-xs action-more"
              title={<span className="icon-ellipsis"></span>}>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-merge"
                   disabled={!this.state.multiSelected}
                   onAction={this.onMerge}
                   confirmLabel="Merge"
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   aggList={this.props.aggList}>
                  Merge Events
                </ActionLink>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-remove-bookmark"
                   disabled={!this.state.anySelected}
                   onAction={this.onRemoveBookmark}
                   neverConfirm={true}
                   actionLabel="remove these {count} events from your bookmarks"
                   onlyIfBulk={true}
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   aggList={this.props.aggList}>
                  Remove from Bookmarks
                </ActionLink>
              </MenuItem>
              <MenuItem divider={true} />
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-delete"
                   disabled={!this.state.anySelected}
                   onAction={this.onDelete}
                   confirmLabel="Delete"
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   aggList={this.props.aggList}>
                  Delete Events
                </ActionLink>
              </MenuItem>
            </DropdownLink>
          </div>

          <div className="btn-group">
            <a className="btn btn-default btn-sm hidden-xs realtime-control"
               onClick={this.props.onRealtimeChange}>
              {(this.props.realtimeActive ?
                <span className="icon icon-pause"></span>
                :
                <span className="icon icon-play"></span>
              )}
            </a>
          </div>
          <SortOptions />

          <div className="btn-group">
            <a href="#" className="btn btn-sm" onClick={this.toggleDatePicker}>
              All time
              <span aria-hidden="true" className="icon-arrow-down"></span>
            </a>
            <div className="datepicker-box dropdown-menu" id="daterange"
                 style={{display: this.state.datePickerActive ? 'block': 'none'}}>
              <form method="GET" action=".">
                <div className="input">
                  <DateTimeField name="df" />
                  to
                  <DateTimeField name="dt" />
                  <div className="help-block">All events are represented in UTC time.</div>
                </div>
                <div className="submit">
                  <div className="pull-right">
                    <button className="btn btn-default btn-sm">Clear</button>
                    <button className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <div className="radio-inputs">
                    <label className="radio">
                      <input type="radio" name="date_type" value="last_seen" /> Last Seen
                    </label>
                    <label className="radio">
                      <input type="radio" name="date_type" value="first_seen" /> First Seen
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="hidden-sm hidden-xs stream-actions-assignee col-md-1">
        </div>
        <div className="hidden-sm hidden-xs stream-actions-graph col-md-2">
          <ul className="toggle-graph">
            <li className={this.props.statsPeriod === '24h' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '24h')}>24h</a>
            </li>
            <li className={this.props.statsPeriod === '30d' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '30d')}>30d</a>
            </li>
          </ul>
        </div>
        <div className="stream-actions-occurrences align-right hidden-xs col-md-1"> events</div>
        <div className="stream-actions-users align-right hidden-xs col-md-1"> users</div>
      </div>
    );
  }
});

module.exports = StreamActions;
