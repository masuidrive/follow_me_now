module TinyDS
class Query
  def initialize(model_class)
    @model_class = model_class
    @q = AppEngine::Datastore::Query.new(@model_class.kind)
  end
  def ancestor(anc)
    anc = case anc
          when Base;   anc.key
          when String; LowDS::KeyFactory.stringToKey(anc)
          when AppEngine::Datastore::Key; anc
          else raise "unknown type. anc=#{anc.inspect}"
          end
    @q.set_ancestor(anc)
    self
  end
  def filter(*args)
    if args.size==1 && args.first.kind_of?(Hash)
      args.first.each do |k,v|
        filter(k,"==",v)
      end
    else
      name, operator, value = *args
      raise "unknown property='#{name}'" unless @model_class.valid_property?(name, :filter)
      @q.filter(name, operator, value)
    end
    self
  end
  def sort(name, dir=:asc)
    raise "unknown property='#{name}'" unless @model_class.valid_property?(name, :sort)
    direction = {
      :asc  => AppEngine::Datastore::Query::ASCENDING,
      :desc => AppEngine::Datastore::Query::DESCENDING
    }[dir]
    @q.sort(name, direction)
    self
  end
  def keys_only
    @q.java_query.setKeysOnly
    self
  end
  def count #todo(tx=nil)
    TinyDS::LowDS.retry_if_timeout do
      @q.count
    end
  end
=begin
  def count2
    _count = 0
    max_key = nil
    loop do
      q = @q.clone # or ruby dup
      q.filter(:__key__, ">", max_key) if max_key
      q.sort(:__key__)
      q.java_query.setKeysOnly
      entries = q.fetch(:limit=>1000).to_a
      #p ["entries=", entries.collect{|e| e.key }]
      c = entries.size
      break if c==0
      _count += c
      max_key = entries.last.key
      #p ["max_key=", max_key]
    end
    _count
  end
=end
  def count3
    c = @q.count
    if c<1000
      return c
    end

    batch_size = 1000
    _count = 0
    max_key = nil
    loop do
      #q = AppEngine::Datastore::Query.new(@model_class.kind)
      #_java_query = @q.java_query.clone # => NativeException: java.lang.CloneNotSupportedException: com.google.appengine.api.datastore.Query
      #q.instance_eval{ @query = _java_query }
      q = @q.clone # TODO should clone java_query
      q.filter(:__key__, ">", max_key) if max_key
      q.sort(:__key__)
      q.java_query.setKeysOnly
      last_entity = q.fetch(:offset=>batch_size-1, :limit=>1).to_a.last
      if last_entity
        _count += batch_size
        max_key = last_entity.key
      else
        _count += q.count
        break
      end
    end
    _count
  end
  def one #todo(tx=nil)
    TinyDS::LowDS.retry_if_timeout do
      if @q.entity
        @model_class.new_from_entity(@q.entity)
      else
        nil
      end
    end
  end
  def all(opts={}) #todo(tx=nil)
    models = nil
    TinyDS::LowDS.retry_if_timeout do
      models = []
      @q.each(opts.dup) do |entity| # memo:http://codereview.appspot.com/962044
        models << @model_class.new_from_entity(entity)
      end
    end
    models
  end
  def each(opts={}) #todo(tx=nil)
    # Don't retry. use all() if need retry.
    @q.each(opts.dup) do |entity| # memo:http://codereview.appspot.com/962044
      yield(@model_class.new_from_entity(entity))
    end
  end
  def collect(opts={}) #todo(tx=nil)
    # Don't retry. use all() if need retry.
    collected = []
    @q.each(opts.dup) do |entity| # memo:http://codereview.appspot.com/962044
      collected << yield(@model_class.new_from_entity(entity))
    end
    collected
  end
  def keys(opts={}) #todo(tx=nil)
    keys = nil
    TinyDS::LowDS.retry_if_timeout do
      keys = []
      self.keys_only
      @q.each(opts.dup) do |entity| # memo:http://codereview.appspot.com/962044
        keys << entity.key
      end
    end
    keys
  end
end
end
