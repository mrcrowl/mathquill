/**
* Usage:
* $(thing).latexlive();
* turns thing into a live editable thingy.
* AMAZORZ.
*
* Note: doesn't actually work.
*
*/

jQuery.fn.latexlive = (function() {

var $ = jQuery, noop = function(){ return this; };

/**
 * MathElement is the core Math DOM tree node prototype.
 * Both MathBlock's and MathCommand's descend from it.
 */
function MathElement(){}
MathElement.prototype = { 
  prev: null,
  next: null,
  parent: null,
  firstChild: null,
  lastChild: null,
  eachChild: function(fn)
  {
    for(var child = this.firstChild; child !== null; child = child.next)
      fn.call(child);
    return this;
  },
  reduceChildren: function(fn, initVal)
  {
    this.eachChild(function(){
      initVal = fn.call(this, initVal);
    });
    return initVal;
  },
  jQ: (function() //closure around the actual jQuery object
  {
    var actual;
    return function(setter)
    {
      if(arguments.length) //not if(setter), which would fail on .jQ(undefined)
        return actual = $(setter);
      return actual;
    };
  }()),
  isEmpty: function()
  {
    return this.firstChild === null && this.lastChild === null;
  },
}

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
function MathBlock(){}
MathBlock.prototype = $.extend(new MathElement, { 
  latex: function()
  {
    return this.reduceChildren(function(initVal){
      return initVal + this.latex();
    }, '');
  },
  /* Remove this?
  html: function()
  { 
    return this.reduceChildren(function(initVal){
      return initVal + this.html();
    }, '');
  },*/
});

function RootMathBlock(arg)
{
  //TODO: figure out what to do with arg
    //should it be latex source to convert to html pretty math?
    //an element to replace?
  this.cursor = new Cursor(this);
  this.jQ().data('latexlive', this);
}
RootMathBlock.prototype = $.extend(new MathBlock, {
  /* Remove this?
  html: function()
  {
    return '<span class="latexlive-generated-math">' + MathBlock.prototype.html.call(this) + '</span>';
  },*/
});

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * May contain descendant commands, organized into blocks.
 */
function MathCommand(cmd, num_blocks, html_template)
{ 
  if(arguments.length == 0)
    return;
  this.cmd = cmd;
  this.num_blocks = num_blocks;
  this.html_template = html_template;
  this.jQinit();
  this.initBlocks();
}
MathCommand.prototype = $.extend(new MathElement, {
  jQinit: function()
  {
    return this.jQ(this.html_template).data('latexlive', {cmd: this});
  },
  initBlocks: function()
  {
    var prev = null, newBlock;
    for(var i = 1; i < this.html_template.length; i += 1)
    {
      newBlock = new MathBlock;
      newBlock.jQ(this.jQ().children().eq(i-1)).data('latexlive', {block: newBlock}); /*** optimize me! ***/
      newBlock.parent = this;
      newBlock.prev = prev;
      if(prev)
        prev.next = newBlock;
      else
        this.firstChild = newBlock;
      prev = newBlock;
    }
    this.lastChild = newBlock;
    return this;
  },
  latex: function()
  {
    return this.cmd + this.reduceChildren(function(initVal){
      return initVal + '{' + this.latex() + '}';
    }, '');
  },
  /* Remove this?
  html: function()
  {
    var i = 0;
    rendered = this.html_template[0];

    that = this;
    this.eachChild(function(){
      i += 1;
      try {
        rendered += this.html() + that.html_template[i];
      } catch(e) {
        //since there may be any number of blocks,
        //we have to take into account the case
        //in which html_template.length < 1 + number of blocks.
        //in this case, just silently fail.
      }
    });
    return rendered;
  },*/
  //placeholder for context-sensitive spacing.
  respace: noop,
  placeCursor: function(cursor)
  {
    cursor.prependTo(this.firstChild);
    return this;
  },
});

/**
 * Lightweight command without blocks or children.
 */
function Symbol(cmd, html)
{
  MathCommand.call(this, cmd, 0, html);
}
Symbol.prototype = $.extend(new MathCommand, {
  initBlocks: noop,
  latex: function()
  {
    return this.cmd;
  },
  placeCursor: noop,
});

function VanillaSymbol(ch, html) 
{
  Symbol.call(this, ch, '<span>'+(html || ch)+'</span>');
}
VanillaSymbol.prototype = Symbol.prototype;

function Variable(ch)
{
  Symbol.call(this, ch, '<i>'+ch+'</i>');
}
Variable.prototype = Symbol.prototype;

function BinaryOperator(cmd, html)
{
  Symbol.call(this, cmd, '<span class="operator">'+html+'</span>');
}
BinaryOperator.prototype = Symbol.prototype;

function PlusMinus(cmd, html)
{
  VanillaSymbol.apply(this, arguments);
}
PlusMinus.prototype = new BinaryOperator('PlusMinus.prototype'); //so instanceof will work
PlusMinus.prototype.respace = function()
{
  if(!this.prev || this.prev instanceof BinaryOperator)
    this.jQ().removeClass('operator');
  else
    this.jQ().addClass('operator');
  return this;
};

//A fake cursor in the fake textbox that the math is rendered in.
function Cursor(block)
{
  if(block)
    this.prependTo(block);
}
Cursor.prototype = {
  prev: null,
  next: null,
  parent: null,
  jQ: MathElement.prototype.jQ,
  jQinit: function()
  {
    return this.jQ('<span class="cursor"></span>');
  },
  setParentEmpty: function()
  {
    if(this.parent)
    {
      this.parent.jQ().removeClass('hasCursor');
      if(this.parent.isEmpty())
        this.paren.jQ().html('[ ]').addClass('empty');
    }
    return this;
  },
  rmParentEmpty:function()
  {
    if(this.parent.isEmpty())
      this.parent.jQ().html('').removeClass('empty');
    return this;
  },
  detach: function()
  {
    this.setParentEmpty();
    this.prev = this.next = this.parent = null;
    this.jQ().detach();
    return this;
  },
  insertBefore: function(el)
  {
    this.setParentEmpty();
    this.next = el;
    this.prev = el.prev;
    this.parent = el.parent;
    this.parent.addClass('hasCursor');
    this.jQ().insertBefore(el.jQ()); 
    return this;
  },
  insertAfter: function(el)
  {
    this.setParentEmpty();
    this.prev = el;
    this.next = el.next
    this.parent = el.parent;
    this.parent.addClass('hasCursor');
    this.jQ().insertAfter(el.jQ());
    return this;
  }, 
  prependTo: function(el)
  {
    this.setParentEmpty();
    this.next = el.firstChild;
    this.prev = null;
    this.parent = el;
    this.rmParentEmpty();
    this.parent.addClass('hasCursor');
    this.jQ().prependTo(el.jQ());
    return this;
  },
  appendTo: function(el)
  {
    this.setParentEmpty();
    this.prev = el.lastChild;
    this.next = null;
    this.parent = el;
    this.rmParentEmpty();
    this.parent.addClass('hasCursor');
    this.jQ().prependTo(el.jQ());
    return this;
  },
  moveLeft: function()
  {
    //this.clearSelection();
    if(this.prev)
      if(this.prev.lastChild)
        this.appendTo(this.prev.lastChild)
      else
      {
        this.next = this.prev;
        this.prev = this.prev.prev;
        this.jQ().insertBefore(this.prev.jQ());
      }
    else //we're at the beginning of a block
      if(this.parent.prev)
        this.appendTo(this.parent.prev);
      else if(this.parent.parent)
        this.insertBefore(this.parent.parent);
    //otherwise we're at the beginning of the root, so do nothing.
    this.jQ().removeClass('blink');
    return this;
  },
  moveRight: function()
  {
    //this.clearSelection();
    if(this.next)
      if(this.next.firstChild)
        this.prependTo(this.next.firstChild)
      else
      {
        this.prev = this.next;
        this.next = this.next.next;
        this.jQ().insertAfter(this.prev.jQ());
      }
    else //we're at the end of a block
      if(this.parent.next)
        this.prependTo(this.parent.next);
      else if(this.parent.parent)
        this.insertAfter(this.parent.parent);
    //otherwise we're at the end of the root, so do nothing.
    this.jQ().removeClass('blink');
    return this;
  },
  newBefore: function(el)
  {
    //this.deleteSelection();
    el.parent = this.parent; 
    el.next = this.next;
    el.prev = this.prev;
    if(this.prev)
      this.prev.next = el;
    else
      this.parent.firstChild = el;
    if(this.next)
      this.next.prev = el;
    else
      this.parent.lastChild = el;
    el.jQ().insertBefore(this.jQ()); 

    //respacing
    el.respace();
    if(this.next)
      this.next.respace();
    if(this.prev)
      this.prev.respace();

    this.prev = el;

    if(el.isEmpty())
      el.placeCursor(this);

    this.jQ().removeClass('blink').change();
  },
  backspace: function()
  {
    if(this.selection)
      this.deleteSelection();
    else if(this.prev && this.prev.isEmpty()) //it's a symbol, delete it.
      this.prev.remove();
    else if(!this.prev && this.parent.parent && this.parent.parent.isEmpty())
      this.insertBefore(this.parent.parent).next.remove();
    else
      this.selectLeft();
    
    this.jQ.removeClass('blink').change();
    if(this.prev)
      this.prev.respace();
    if(this.next)
      this.next.respace();
    
    return this;
  },
  deleteForward: function()
  {
    if(this.selection)
      this.deleteSelection();
    else if(this.next && this.next.isEmpty()) //it's a symbol!
      this.next.remove();
    else if(!this.next && this.parent.parent && this.parent.parent.isEmpty())
      this.insertBefore(this.parent.parent).next.remove();
    else
      this.selectRight();
    
    this.jQ.removeClass('blink').change();
    if(this.prev)
      this.prev.respace();
    if(this.next)
      this.next.respace();
    
    return this;
  },
}

//A fake selection in the fake textbox that the math is rendered in.
function Selection(parent, prev, next)
{
  if((prev && prev.parent !== parent) || (next && next.parent !== parent))
    throw 'arguments to Selection not properly related';
  if(parent.isEmpty())
    return new Cursor(parent);
  else if(!(this instanceof Selection))
    return new Selection(parent, prev, next);
  
  this.parent = parent;
  this.prev = prev;
  this.next = next;
  
  if(prev)
    prev.jQ().nextUntil(next && next.jQ()).wrapAll(this.jQ('<span class="selection"></span>'));
  else
    parent.firstChild.jQ().nextUntil(next && next.jQ()).andSelf().wrapAll(this.jQ('<span class="selection"></span>'));
}
Selection.prototype = {
  jQ: MathBlock.prototype.jQ,
  each: function(fn)
  {
    for(var el = (this.prev ? this.prev.next : this.parent.firstChild); el !== this.next; el = el.next)
      fn.call(el);
  },
};

//on document ready, replace the contents of all <tag class="latexlive-embedded-math"></tag> elements
//with RootMathBlock's.
$(

//The actual, publically exposed method of jQuery.prototype, available
//(and meant to be called) on jQuery-wrapped HTML DOM elements.
return function(tabindex)
{
  var root = new RootMathBlock(this), cursor = root.cursor;
  root.jQ().attr('tabindex', tabindex || 0).click(function(e)
  {
    var jQ = $(e.target);
    if(jQ.hasClass('empty'))
    {
      cursor.prependTo(jQ.data('latexlive')).jQ().show();
      return false;
    }
    var cmd = jQ.data('latexlive');
    if(!cmd && !(cmd = (jQ = jQ.parent()).data('latexlive'))) // all clickables not MathCommands are either LatexBlocks or like sqrt radicals or parens, both of whose immediate parents are LatexCommands
      return;
    cursor.jQ().show();
    cursor.clearSelection();
    if((e.pageX - jQ.offset().left)*2 < jQ.outerWidth())
      cursor.insertBefore(cmd);
    else
      cursor.insertAfter(cmd);
    return false;
  });
  cursor.prependTo(this);
};

})();