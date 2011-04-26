var formatDate = function(date){
    if(typeof date == 'undefined') {
	date = new Date();
    }
    var datestr = String.format("%d/%d/%d", date.getMonth()+1, date.getDate(), date.getFullYear());
    if (date.getHours() >= 12) {
           datestr+=' '+(date.getHours()==12 ? 
			 date.getHours() : date.getHours()-12)+':'+
            date.getMinutes()+' PM';
    }
    else {
	datestr +=' '+date.getHours()+':'+date.getMinutes()+' AM';
    }
    return datestr;
};

var TableView = function(args) {
    var border = Ti.UI.createView({
	backgroundColor:"#576c89",
	height:2,
	bottom:0
    });
    
    this.tableHeader = Ti.UI.createView({
	backgroundColor:"#e2e7ed",
	width:320,
	height:60
    });
    this.tableHeader.add(border);
    
    this.arrow = Ti.UI.createView({
	backgroundImage:"images/whiteArrow.png",
	width:23,
	height:60,
	bottom:10,
	left:20
    });
    this.tableHeader.add(this.arrow);
    
    this.statusLabel = Ti.UI.createLabel({
	text:"Pull to reload",
	left:55,
	width:200,
	bottom:30,
	height:"auto",
	color:"#576c89",
	textAlign:"center",
	font:{fontSize:13,fontWeight:"bold"},
	shadowColor:"#999",
	shadowOffset:{x:0,y:1}
    });
    this.tableHeader.add(this.statusLabel);
 
    this.lastUpdatedLabel = Ti.UI.createLabel({
	text:"",
	left:55,
	width:200,
	bottom:15,
	height:"auto",
	color:"#576c89",
	textAlign:"center",
	font:{fontSize:12},
	shadowColor:"#999",
	shadowOffset:{x:0,y:1}
    });
    this.tableHeader.add(this.lastUpdatedLabel);
    
    this.actInd = Titanium.UI.createActivityIndicator({
	left:20,
	bottom:13,
	width:30,
	height:30
    });
    this.tableHeader.add(this.actInd);

    this.view = Ti.UI.createTableView(args);
    this.view.headerPullView = this.tableHeader;
    
    var self = this;
    this.view.addEventListener('scroll', function(e) {
	self.on_scroll(e);
    });
    
    this.view.addEventListener('scrollEnd', function(e) {
	self.on_scroll_end(e);
    });

    this.pulling = false;
    this.reloading = false;
    
    this.setLastUpdated();
};

TableView.prototype.setLastUpdated = function(date) {
    this.lastUpdatedLabel.text = L('Last Updated: ') + formatDate(date);
};

TableView.prototype.reloadEnd = function(message) {
    this.view.setContentInsets({top:0},{animated:true});
    this.reloading = false;
    this.statusLabel.text = L("Pull down to refresh...");
    this.actInd.hide();
    this.arrow.show();
};

TableView.prototype.on_scroll = function(e) {
    var offset = e.contentOffset.y;
    if (offset <= -65.0 && !this.pulling) {
	var transform1 = Ti.UI.create2DMatrix();
	transform1 = transform1.rotate(-180);
	this.pulling = true;
	this.arrow.animate({transform:transform1,duration:180});
	this.statusLabel.text = L("Release to refresh...");
    }
    else if (this.pulling && offset > -65.0 && offset < 0) {
	this.pulling = false;
	var transform2 = Ti.UI.create2DMatrix();
	this.arrow.animate({transform:transform2,duration:180});
	this.statusLabel.text = L("Pull down to refresh...");
    }
};

TableView.prototype.on_scroll_end = function(e) {
    if (this.pulling && !this.reloading && e.contentOffset.y <= -65.0) {
	this.reloading = true;
	this.pulling = false;
	this.arrow.hide();
	this.actInd.show();
	this.statusLabel.text = L("Reloading...");
	this.view.setContentInsets({top:60},{animated:true});
	this.arrow.transform=Ti.UI.create2DMatrix();
	this.view.fireEvent('reload');
    }
};

exports.createTableView = function(args) {
    return new TableView(args);
};

