var deepqlearn = deepqlearn || { REVISION: 'ALPHA' };

(function(global) {
  "use strict";
  // A Brain object does all the magic.
  // over time it receives some inputs and some rewards
  // and its job is to set the outputs to maximize the expected reward
  var Market = function(info_object) {
    // some housekeeping variables
    this.preparation = null;

    // A DOM element to which the Market writes state informations
    this.info_object = info_object;

    this.stocks = [
      { name: "3M", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_3m.csv" },
      { name: "Adobe", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_adobe.csv" },
      { name: "AES", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_aes.csv" },
      { name: "CA", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_ca.csv" },
      { name: "Gannett", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_gannett.csv" },
      { name: "GE", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_general_electric.csv" },
      { name: "nov", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_nov.csv" },
      { name: "FeDex", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_fedex.csv" },
      { name: "SunTrust", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_sun_trust.csv" },
      { name: "USB", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_usb.csv" },
      { name: "Yahoo", shares: 0, transactions: {costs: 0, history: []}, url: "https://copy.com/YGspz82MzstCE9p3/stocks/stock_yahoo.csv" }
    ];

    // keeps track of how much capital the agent has
    this.capital = 100000;
    // defines the starting day
    this.current = 3909;
    // defines how many days should be taken in to account
    this.trading_days_past = 90;
    // contains later, after the preparation, all the days
    // the current day can than be selected with this.days[this.current]
    this.days = [];
    // defines how far back the stocks should go; in trading days
    this.past_start = 4000;
    // defines how much get usually bought/sold with one trade
    this.amount = 5000;
    // defines the fixed costs for each trade
    this.commission = 10;

    this.preparation = 'preparing stocks ...';
    this.visSelf();
    this.loadStocks();
  }

  Market.prototype = {
    get_new_state: function() {
      var new_state = [];
      for (var key in this.stocks) {
        var stock = this.stocks[key];
        new_state.push(
          // flattens the 90 days with their data
          // and adds capital and holding shares
          [].concat.apply(
            [],
            stock.data.slice(
              this.current,
              (this.current + this.trading_days_past)
            ).concat([this.capital, stock.shares])
          )
        );
      }
      // step one trading day up
      this.current--;
      this.current_state = new_state;
      return new_state;
    },
    make_transaction: function(stock, shares) {
      if((shares > 0 && this.amount < this.capital) || (shares < 0 && this.stocks[stock].shares >= shares)) {
        this.stocks[stock].transactions.costs -= this.commission;
        if(shares > 0) {
          this.capital -= shares * this.current_state[stock][3];
          this.stocks[stock].transactions.history.push({
            shares: shares,
            price: this.current_state[stock][3],
            value: (shares * this.current_state[stock][3])
          });
        } else if(shares < 0) {
          var final_cash = 0;
          var final_reward = 0;
          for(var key in this.stocks[stock].transactions.history) {
            var tran = this.stocks[stock].transactions.history[key];
            var current_value = tran.shares * this.current_state[stock][3];
            final_cash += current_value;
            final_reward += current_value - tran.value;
          }
          this.capital += (final_cash + this.stocks[stock].transactions.costs);
          this.stocks[stock].transactions.history = [];
          this.stocks[stock].transactions.costs = 0;
          return (final_reward + this.stocks[stock].transactions.costs);
        }
      } else {
        this.stocks[stock].transactions.costs -= this.commission;
      }
    },
    buy: function(stock) {
      this.make_transaction(stock, Math.floor(this.amount / this.current_state[stock][3]));
    },
    sell: function(stock, is_all) {
      if(is_all) {
        return this.make_transaction(stock, -1);
      } else {
        return this.make_transaction(stock, Math.floor(this.stocks[stock].shares * -0.5));
      }
    },
    get_value: function() {
      var value = 0;
      for (var key in this.stocks) {
        var stock = this.stocks[key];
        if(this.current_state) {
          for (var keyTran in stock.transactions.history) {
            var tran = stock.transactions.history[key];
            value += ((tran.shares * this.current_state[key][3]) + stock.transactions.costs);
          }
        }
      }
      return (this.capital + value);
    },
    do_action: function(stock, action) {
      if(action == 0) {
        return 0;
      } else if(action == 1) {
        this.buy(stock);
        return 0;
      } else if(action == 2) {
        return this.sell(stock, true);
      }
    },
    loadStocks: function() {
      var selected = null;
      var that = this;
      for (var key in this.stocks) {
        var stock = this.stocks[key];
        if(!stock.data) {
          selected = parseInt(key)
          break;
        }
      }

      if(selected !== null) {
        Papa.parse(stock.url, {
          download: true,
          dynamicTyping: true,
          complete: function(results) {
            results.data.shift(); // remove header
            // remove unused columns
            // and fill this.days
            for (var key in results.data) {
              var value = results.data[key];
              if(parseInt(key) <= that.past_start) {
                that.days.push(value.splice(0, 1));
              } else {
                value.splice(0, 1);
              }
              value.splice(5, 1);
            }
            that.stocks[selected].data = results.data.slice(0, (that.past_start -1));
            that.preparation = 'preparing stock ' + (selected + 1) + ' / ' + that.stocks.length;
            that.visSelf();
            that.loadStocks();
          }
        });
      } else {
        that.preparation = 'preparation done';
        document.getElementById('start').style.display = "block";
        that.visSelf();
      }
    },
    visSelf: function() {
      this.info_object.innerHTML = ''; // erase this.info_object first

      // this.info_object is a DOM element that this function fills with brain-related information
      var brainvis = document.createElement('div');

      // basic information
      var desc = document.createElement('div');
      var t = '';
      t += 'preparation: ' + this.preparation + '<br>';
      t += 'capital: ' + Math.round(this.capital, 2) + ' EUR<br>';
      t += 'total value: ' + Math.round(this.get_value()) + ' EUR<br>';
      t += 'day: ' + this.days[this.current] + '<br>';
      t += 'current turn: ' + this.current + '<br>';
      for(var key in this.stocks) {
        t += '&nbsp;&nbsp;' + this.stocks[key].name + ' (shares): ' + this.stocks[key].shares + ' <br>';
      }
      desc.innerHTML = t;
      brainvis.appendChild(desc);

      this.info_object.appendChild(brainvis);
    }
  }

  global.Market = Market;
})(deepqlearn);

(function(lib) {
  "use strict";
  if (typeof module === "undefined" || typeof module.exports === "undefined") {
    window.deepqlearn = lib; // in ordinary browser attach library to window
  } else {
    module.exports = lib; // in nodejs
  }
})(deepqlearn);
